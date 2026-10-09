// routes/quizRoutes.js - Quiz Execution & Attempt Restriction Engine

const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../data/db');

// Helper to get userId from header or query
function extractUserId(req) {
  if (req.body && req.body.userId) return req.body.userId;
  if (req.query && req.query.userId) return req.query.userId;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [userId] = decoded.split(':');
      return userId;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// GET /api/quizzes/:categoryId/status - Check user's attempt status for a category
router.get('/:categoryId/status', (req, res) => {
  const { categoryId } = req.params;
  const userId = extractUserId(req);

  const db = getDb();
  const category = db.categories.find(c => c.id === categoryId);

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const categoryQuestions = db.questions.filter(q => q.categoryId === categoryId);
  const userAttempts = userId 
    ? db.attempts.filter(a => a.userId === userId && a.categoryId === categoryId)
    : [];

  const attemptCount = userAttempts.length;
  const maxAttempts = 2;
  const canAttempt = attemptCount < maxAttempts && categoryQuestions.length > 0;

  res.json({
    categoryId: category.id,
    categoryName: category.name,
    difficulty: category.difficulty,
    badgeClass: category.badgeClass,
    description: category.description,
    totalTimeMinutes: category.totalTimeMinutes,
    totalQuestions: categoryQuestions.length,
    attemptCount,
    maxAttempts,
    canAttempt,
    isMaxReached: attemptCount >= maxAttempts,
    userAttempts: userAttempts.sort((a, b) => a.attemptNumber - b.attemptNumber)
  });
});

// GET /api/quizzes/:categoryId/questions - Fetch quiz questions without leaking answers
router.get('/:categoryId/questions', (req, res) => {
  const { categoryId } = req.params;
  const userId = extractUserId(req);

  const db = getDb();
  const category = db.categories.find(c => c.id === categoryId);

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Enforce attempt restriction
  if (userId) {
    const userAttempts = db.attempts.filter(a => a.userId === userId && a.categoryId === categoryId);
    if (userAttempts.length >= 2) {
      return res.status(403).json({
        error: 'Maximum attempts reached (2/2) for this quiz. You cannot take this quiz again.',
        attemptsReached: true
      });
    }
  }

  const questions = db.questions.filter(q => q.categoryId === categoryId);
  if (questions.length === 0) {
    return res.status(404).json({ error: 'No questions currently available in this category' });
  }

  // Sanitize: strip out correctIndex and explanation to prevent inspect-element cheating
  const sanitized = questions.map(q => ({
    id: q.id,
    categoryId: q.categoryId,
    questionText: q.questionText,
    options: q.options
  }));

  res.json({
    category: {
      id: category.id,
      name: category.name,
      totalTimeMinutes: category.totalTimeMinutes,
      difficulty: category.difficulty
    },
    totalQuestions: sanitized.length,
    questions: sanitized
  });
});

// POST /api/quizzes/:categoryId/submit - Submit quiz and calculate score
router.post('/:categoryId/submit', (req, res) => {
  const { categoryId } = req.params;
  const { answers } = req.body;
  const userId = extractUserId(req);

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required to submit quiz attempt' });
  }

  const db = getDb();
  const category = db.categories.find(c => c.id === categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const user = db.users.find(u => u.id === userId);
  const userName = user ? user.name : 'Unknown User';
  const userEmail = user ? user.email : 'unknown@user.com';

  // Strict 2-Attempt Restriction check
  const priorAttempts = db.attempts.filter(a => a.userId === userId && a.categoryId === categoryId);
  if (priorAttempts.length >= 2) {
    return res.status(403).json({
      error: 'Submission rejected: Maximum attempts (2/2) already reached for this quiz.',
      isMaxReached: true
    });
  }

  const questions = db.questions.filter(q => q.categoryId === categoryId);
  const totalQuestions = questions.length;
  let correctCount = 0;

  // Process answers and evaluate correctness
  const detailedAnswers = questions.map(q => {
    // User answer provided for this question
    const userAns = Array.isArray(answers) ? answers.find(a => a.questionId === q.id) : null;
    const selectedOption = userAns !== undefined && userAns !== null ? userAns.selectedOption : null;
    const isCorrect = selectedOption === q.correctIndex;

    if (isCorrect) {
      correctCount++;
    }

    return {
      questionId: q.id,
      questionText: q.questionText,
      options: q.options,
      selectedOption: selectedOption !== undefined ? selectedOption : null,
      correctOption: q.correctIndex,
      isCorrect,
      explanation: q.explanation || 'No rationale available.'
    };
  });

  const nextAttemptNumber = priorAttempts.length + 1;
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const passed = percentage >= 60;

  const newAttempt = {
    id: `att-${Date.now()}`,
    userId,
    userName,
    userEmail,
    categoryId: category.id,
    categoryName: category.name,
    attemptNumber: nextAttemptNumber,
    score: correctCount,
    totalQuestions,
    percentage,
    passed,
    timestamp: new Date().toISOString(),
    answers: detailedAnswers
  };

  db.attempts.push(newAttempt);
  saveDb(db);

  res.status(201).json({
    message: 'Quiz submitted successfully',
    attempt: newAttempt,
    remainingAttempts: 2 - nextAttemptNumber
  });
});

// GET /api/quizzes/attempt/:attemptId - Get full review of a specific attempt
router.get('/attempt/:attemptId', (req, res) => {
  const { attemptId } = req.params;
  const db = getDb();
  const attempt = db.attempts.find(a => a.id === attemptId);

  if (!attempt) {
    return res.status(404).json({ error: 'Attempt record not found' });
  }

  res.json(attempt);
});

// GET /api/quizzes/:categoryId/attempts - Get all attempts of user for this category
router.get('/:categoryId/attempts', (req, res) => {
  const { categoryId } = req.params;
  const userId = extractUserId(req);

  if (!userId) {
    return res.status(401).json({ error: 'User identification required' });
  }

  const db = getDb();
  const userAttempts = db.attempts
    .filter(a => a.userId === userId && a.categoryId === categoryId)
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  res.json(userAttempts);
});

module.exports = router;
