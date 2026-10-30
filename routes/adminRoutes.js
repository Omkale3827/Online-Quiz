// routes/adminRoutes.js - Admin Analytics & Submission Tracking

const express = require('express');
const router = express.Router();
const { getDb, resetDb } = require('../data/db');

// GET /api/admin/analytics - Platform Metrics
router.get('/analytics', (req, res) => {
  const db = getDb();

  const totalCategories = db.categories.length;
  const totalQuestions = db.questions.length;
  const registeredUsers = db.users.filter(u => u.role === 'ROLE_USER').length;
  const totalAttempts = db.attempts.length;

  // Calculate average score across all attempts
  let averageScore = 0;
  let passCount = 0;
  if (totalAttempts > 0) {
    const sumPercentage = db.attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
    averageScore = Math.round(sumPercentage / totalAttempts);
    passCount = db.attempts.filter(a => a.passed).length;
  }
  const passRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0;

  // Category breakdown
  const categoryStats = db.categories.map(cat => {
    const catQuestions = db.questions.filter(q => q.categoryId === cat.id).length;
    const catAttempts = db.attempts.filter(a => a.categoryId === cat.id);
    const catAvgScore = catAttempts.length > 0 
      ? Math.round(catAttempts.reduce((acc, c) => acc + c.percentage, 0) / catAttempts.length)
      : 0;

    return {
      id: cat.id,
      name: cat.name,
      difficulty: cat.difficulty,
      questionsCount: catQuestions,
      attemptsCount: catAttempts.length,
      averageScore: catAvgScore
    };
  });

  res.json({
    metrics: {
      totalCategories,
      totalQuestions,
      registeredUsers,
      totalAttempts,
      averageScore,
      passRate
    },
    categoryStats,
    recentAttempts: db.attempts.slice(-5).reverse()
  });
});

// GET /api/admin/users - Registered Users with statistics
router.get('/users', (req, res) => {
  const db = getDb();
  const usersWithStats = db.users.map(u => {
    const attempts = db.attempts.filter(a => a.userId === u.id);
    const completedQuizzes = new Set(attempts.map(a => a.categoryId)).size;
    const avgScore = attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length)
      : 0;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      totalAttempts: attempts.length,
      completedQuizzes,
      averageScore: avgScore
    };
  });

  res.json(usersWithStats);
});

// GET /api/admin/attempts - Detailed user attempt tracker with Latest vs Previous Attempt
router.get('/attempts', (req, res) => {
  const db = getDb();
  
  // Group attempts by user and category to compare Latest vs Previous Attempt
  const grouped = {};

  db.attempts.forEach(attempt => {
    const key = `${attempt.userId}_${attempt.quizId || attempt.categoryId}`;
    if (!grouped[key]) {
      grouped[key] = {
        userId: attempt.userId,
        userName: attempt.userName,
        userEmail: attempt.userEmail,
        categoryId: attempt.categoryId,
        categoryName: attempt.categoryName,
        quizId: attempt.quizId || null,
        quizTitle: attempt.quizTitle || null,
        attempts: []
      };
    }
    grouped[key].attempts.push(attempt);
  });

  // Transform each group into a tracker record with latest and previous attempt
  const userQuizLogs = Object.values(grouped).map(group => {
    // Sort ascending by timestamp or attemptNumber
    group.attempts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const totalAttemptsMade = group.attempts.length;
    let latestAttempt = null;
    let previousAttempt = null;

    if (totalAttemptsMade === 1) {
      latestAttempt = group.attempts[0];
      previousAttempt = null; // No previous attempt
    } else if (totalAttemptsMade >= 2) {
      previousAttempt = group.attempts[0];
      latestAttempt = group.attempts[group.attempts.length - 1];
    }

    // Score improvement delta
    let scoreImprovement = null;
    if (previousAttempt && latestAttempt) {
      scoreImprovement = latestAttempt.percentage - previousAttempt.percentage;
    }

    return {
      userId: group.userId,
      userName: group.userName,
      userEmail: group.userEmail,
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      quizId: group.quizId,
      quizTitle: group.quizTitle,
      totalAttemptsMade,
      isMaxReached: totalAttemptsMade >= 2,
      latestAttempt,
      previousAttempt,
      scoreImprovement
    };
  });

  // Also include chronological flat attempts list
  const flatAttempts = [...db.attempts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    userQuizLogs,
    allAttempts: flatAttempts
  });
});

// POST /api/admin/reset - Reset to default seed data
router.post('/reset', (req, res) => {
  const freshDb = resetDb();
  res.json({
    message: 'System database successfully reset to clean seed state',
    totalCategories: freshDb.categories.length,
    totalQuestions: freshDb.questions.length,
    totalUsers: freshDb.users.length,
    totalAttempts: freshDb.attempts.length
  });
});

module.exports = router;
