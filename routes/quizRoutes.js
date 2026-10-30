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

// Helper to resolve category and quiz from params/query
function resolveQuizContext(db, paramId, queryQuizId, bodyQuizId) {
  const targetQuizId = bodyQuizId || queryQuizId || (paramId && paramId.startsWith('quiz-') ? paramId : null);

  let quiz = null;
  let category = null;

  if (targetQuizId && db.quizzes) {
    quiz = db.quizzes.find(qz => qz.id === targetQuizId);
  }

  if (quiz) {
    category = db.categories.find(c => c.id === quiz.categoryId);
  } else {
    // Treat paramId as categoryId
    category = db.categories.find(c => c.id === paramId);
    if (category && db.quizzes) {
      const categoryQuizzes = db.quizzes.filter(qz => qz.categoryId === category.id);
      if (categoryQuizzes.length > 0) {
        quiz = categoryQuizzes[0]; // default to first quiz
      }
    }
  }

  return { category, quiz };
}

// GET /api/quizzes/:categoryId/status - Check user's attempt status for a category or quiz
router.get('/:categoryId/status', (req, res) => {
  const { categoryId } = req.params;
  const { quizId } = req.query;
  const userId = extractUserId(req);

  const db = getDb();
  const { category, quiz } = resolveQuizContext(db, categoryId, quizId);

  if (!category) {
    return res.status(404).json({ error: 'Category or quiz not found' });
  }

  // Get all quizzes in this category
  const allCategoryQuizzes = (db.quizzes || []).filter(qz => qz.categoryId === category.id);

  // If a specific quiz was requested (or if resolving a single quiz)
  const targetQuiz = quiz || (allCategoryQuizzes.length > 0 ? allCategoryQuizzes[0] : null);

  // Find questions for target quiz
  let targetQuestions = [];
  if (targetQuiz) {
    targetQuestions = db.questions.filter(q => q.quizId === targetQuiz.id);
    if (targetQuestions.length === 0) {
      // Fallback: questions with categoryId
      targetQuestions = db.questions.filter(q => q.categoryId === category.id).slice(0, 5);
    }
  } else {
    targetQuestions = db.questions.filter(q => q.categoryId === category.id);
  }

  // Get user attempts for target quiz/category
  const userAttempts = userId 
    ? db.attempts.filter(a => {
        if (targetQuiz && a.quizId) {
          return a.userId === userId && a.quizId === targetQuiz.id;
        }
        return a.userId === userId && a.categoryId === category.id;
      })
    : [];

  const attemptCount = userAttempts.length;
  const maxAttempts = 2;
  const canAttempt = attemptCount < maxAttempts && targetQuestions.length > 0;

  // Enhance each quiz in domain with current user's attempt status
  const quizzesWithStatus = allCategoryQuizzes.map(qz => {
    const qzQuestions = db.questions.filter(q => q.quizId === qz.id);
    const qzAttempts = userId
      ? db.attempts.filter(a => a.userId === userId && (a.quizId === qz.id || (!a.quizId && a.categoryId === category.id && qz.quizNumber === 1)))
      : [];
    return {
      ...qz,
      questionsCount: qzQuestions.length > 0 ? qzQuestions.length : 5,
      attemptCount: qzAttempts.length,
      maxAttempts: 2,
      canAttempt: qzAttempts.length < 2 && (qzQuestions.length > 0 || db.questions.filter(q => q.categoryId === category.id).length > 0),
      isMaxReached: qzAttempts.length >= 2,
      userAttempts: qzAttempts.sort((a, b) => a.attemptNumber - b.attemptNumber)
    };
  });

  res.json({
    categoryId: category.id,
    categoryName: category.name,
    difficulty: category.difficulty,
    badgeClass: category.badgeClass,
    description: category.description,
    totalTimeMinutes: category.totalTimeMinutes,
    totalQuestions: targetQuestions.length,
    quizId: targetQuiz ? targetQuiz.id : null,
    quizTitle: targetQuiz ? targetQuiz.title : 'Quiz 1',
    attemptCount,
    maxAttempts,
    canAttempt,
    isMaxReached: attemptCount >= maxAttempts,
    userAttempts: userAttempts.sort((a, b) => a.attemptNumber - b.attemptNumber),
    quizzes: quizzesWithStatus
  });
});

// GET /api/quizzes/:categoryId/questions - Fetch quiz questions without leaking answers
router.get('/:categoryId/questions', (req, res) => {
  const { categoryId } = req.params;
  const { quizId } = req.query;
  const userId = extractUserId(req);

  const db = getDb();
  const { category, quiz } = resolveQuizContext(db, categoryId, quizId);

  if (!category) {
    return res.status(404).json({ error: 'Category or quiz not found' });
  }

  const targetQuiz = quiz;

  // Enforce attempt restriction
  if (userId) {
    const userAttempts = db.attempts.filter(a => {
      if (targetQuiz && a.quizId) {
        return a.userId === userId && a.quizId === targetQuiz.id;
      }
      return a.userId === userId && a.categoryId === category.id;
    });

    if (userAttempts.length >= 2) {
      return res.status(403).json({
        error: 'Maximum attempts reached (2/2) for this quiz. You cannot take this quiz again.',
        attemptsReached: true
      });
    }
  }

  let questions = [];
  if (targetQuiz) {
    questions = db.questions.filter(q => q.quizId === targetQuiz.id);
    if (questions.length === 0) {
      questions = db.questions.filter(q => q.categoryId === category.id).slice(0, 5);
    }
  } else {
    questions = db.questions.filter(q => q.categoryId === category.id).slice(0, 5);
  }

  if (questions.length === 0) {
    return res.status(404).json({ error: 'No questions currently available in this quiz' });
  }

  // Sanitize: strip out correctIndex and explanation to prevent inspect-element cheating
  const sanitized = questions.map(q => ({
    id: q.id,
    categoryId: q.categoryId,
    quizId: q.quizId || (targetQuiz ? targetQuiz.id : null),
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
    quiz: targetQuiz ? {
      id: targetQuiz.id,
      title: targetQuiz.title,
      quizNumber: targetQuiz.quizNumber
    } : {
      id: `quiz-${category.id}-1`,
      title: 'Quiz 1',
      quizNumber: 1
    },
    totalQuestions: sanitized.length,
    questions: sanitized
  });
});

// POST /api/quizzes/:categoryId/lock-answer - Evaluate single answer upon confirmation without leaking other answers
router.post('/:categoryId/lock-answer', (req, res) => {
  const { questionId, selectedOption, isSkipped } = req.body;
  const db = getDb();

  const question = db.questions.find(q => q.id === questionId);
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }

  if (isSkipped) {
    return res.json({
      questionId,
      isSkipped: true,
      isCorrect: false,
      correctOption: null, // Hidden until final review
      explanation: 'Question was skipped using Lifeline.'
    });
  }

  const isCorrect = Number(selectedOption) === question.correctIndex;
  res.json({
    questionId,
    isCorrect,
    correctOption: question.correctIndex,
    explanation: question.explanation || 'No rationale available.'
  });
});

// POST /api/quizzes/:categoryId/lifeline-5050 - Eliminate two incorrect options
router.post('/:categoryId/lifeline-5050', (req, res) => {
  const { questionId } = req.body;
  const db = getDb();

  const question = db.questions.find(q => q.id === questionId);
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const correctIndex = question.correctIndex;
  const incorrectIndices = [0, 1, 2, 3].filter(idx => idx !== correctIndex && idx < question.options.length);

  // Randomly shuffle incorrect indices and pick 2 to eliminate
  const shuffled = incorrectIndices.sort(() => 0.5 - Math.random());
  const eliminated = shuffled.slice(0, 2).sort((a, b) => a - b);

  res.json({
    questionId,
    eliminatedIndices: eliminated
  });
});

// POST /api/quizzes/:categoryId/lifeline-change - Replace current question with another eligible question from same subject
router.post('/:categoryId/lifeline-change', (req, res) => {
  const { categoryId } = req.params;
  const { currentQuestionId, usedQuestionIds = [] } = req.body;
  const db = getDb();

  const category = db.categories.find(c => c.id === categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Find candidate questions in same category not in usedQuestionIds
  let pool = db.questions.filter(q => q.categoryId === category.id && !usedQuestionIds.includes(q.id) && q.id !== currentQuestionId);

  // If pool is empty in same category, fallback to any question not used
  if (pool.length === 0) {
    pool = db.questions.filter(q => !usedQuestionIds.includes(q.id) && q.id !== currentQuestionId);
  }

  if (pool.length === 0) {
    return res.status(400).json({ error: 'No alternate questions available in this domain' });
  }

  // Pick a random question from pool
  const replacement = pool[Math.floor(Math.random() * pool.length)];

  // Return sanitized question (never leak correct answer)
  res.json({
    newQuestion: {
      id: replacement.id,
      categoryId: replacement.categoryId,
      questionText: replacement.questionText,
      options: replacement.options
    }
  });
});

// POST /api/quizzes/:categoryId/submit - Submit quiz and calculate score
router.post('/:categoryId/submit', (req, res) => {
  const { categoryId } = req.params;
  const { answers, quizId, lifelinesUsed } = req.body;
  const userId = extractUserId(req);

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required to submit quiz attempt' });
  }

  const db = getDb();
  const { category, quiz } = resolveQuizContext(db, categoryId, quizId, req.body.quizId);

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const user = db.users.find(u => u.id === userId);
  const userName = user ? user.name : 'Unknown User';
  const userEmail = user ? user.email : 'unknown@user.com';

  const targetQuiz = quiz;
  const targetQuizId = targetQuiz ? targetQuiz.id : (quizId || `quiz-${category.id}-1`);
  const targetQuizTitle = targetQuiz ? targetQuiz.title : 'Quiz 1';

  // Strict 2-Attempt Restriction check per quiz
  const priorAttempts = db.attempts.filter(a => {
    if (a.quizId) {
      return a.userId === userId && a.quizId === targetQuizId;
    }
    return a.userId === userId && a.categoryId === category.id;
  });

  if (priorAttempts.length >= 2) {
    return res.status(403).json({
      error: 'Submission rejected: Maximum attempts (2/2) already reached for this quiz.',
      isMaxReached: true
    });
  }

  // Get the questions for this quiz (matching answered questions if lifelines replaced any)
  let questions = [];
  if (Array.isArray(answers) && answers.length > 0) {
    const answeredQIds = answers.map(a => a.questionId);
    questions = db.questions.filter(q => answeredQIds.includes(q.id));
  }
  if (questions.length === 0) {
    if (targetQuiz) {
      questions = db.questions.filter(q => q.quizId === targetQuiz.id);
      if (questions.length === 0) {
        questions = db.questions.filter(q => q.categoryId === category.id).slice(0, 5);
      }
    } else {
      questions = db.questions.filter(q => q.categoryId === category.id).slice(0, 5);
    }
  }

  const totalQuestions = questions.length || 5;
  let correctCount = 0;
  let skippedCount = 0;

  // Process answers and evaluate correctness
  const detailedAnswers = questions.map(q => {
    const userAns = Array.isArray(answers) ? answers.find(a => a.questionId === q.id) : null;
    const isSkipped = !!(userAns && userAns.isSkipped);
    const selectedOption = !isSkipped && userAns !== undefined && userAns !== null && userAns.selectedOption !== null && userAns.selectedOption !== undefined
      ? Number(userAns.selectedOption)
      : null;
    const isCorrect = !isSkipped && selectedOption === q.correctIndex;

    if (isCorrect) {
      correctCount++;
    } else if (isSkipped) {
      skippedCount++;
    }

    return {
      questionId: q.id,
      questionText: q.questionText,
      options: q.options,
      selectedOption: selectedOption,
      correctOption: q.correctIndex,
      isCorrect,
      isSkipped,
      explanation: q.explanation || 'No rationale available.'
    };
  });

  const nextAttemptNumber = priorAttempts.length + 1;
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const passed = percentage >= 60;
  const incorrectCount = Math.max(0, totalQuestions - correctCount - skippedCount);

  const newAttempt = {
    id: `att-${Date.now()}`,
    userId,
    userName,
    userEmail,
    categoryId: category.id,
    categoryName: category.name,
    quizId: targetQuizId,
    quizTitle: targetQuizTitle,
    attemptNumber: nextAttemptNumber,
    score: correctCount,
    totalQuestions,
    correctCount,
    incorrectCount,
    skippedCount,
    percentage,
    passed,
    lifelinesUsed: lifelinesUsed || {},
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

// GET /api/quizzes/:categoryId/attempts - Get all attempts of user for this category / quiz
router.get('/:categoryId/attempts', (req, res) => {
  const { categoryId } = req.params;
  const { quizId } = req.query;
  const userId = extractUserId(req);

  if (!userId) {
    return res.status(401).json({ error: 'User identification required' });
  }

  const db = getDb();
  const userAttempts = db.attempts
    .filter(a => {
      if (quizId && a.quizId) {
        return a.userId === userId && a.quizId === quizId;
      }
      return a.userId === userId && a.categoryId === categoryId;
    })
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  res.json(userAttempts);
});

module.exports = router;
