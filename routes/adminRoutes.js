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

// GET /api/admin/attempts - Detailed user attempt tracker with Latest vs Previous Attempt, Subject Filtering & Average Ranking
router.get('/attempts', (req, res) => {
  const db = getDb();
  const { subject, sortBy } = req.query;
  
  // 1. Calculate each candidate's overall marks across all their attempted subjects
  // Formula: Average = Total marks obtained / Number of subjects with valid marks
  // For each candidate and unique subject, identify their latest attempt score
  const userSubjectLatestScores = {}; // userId -> { categoryId: { score, percentage, timestamp } }
  
  db.attempts.forEach(attempt => {
    const uid = attempt.userId;
    const cid = attempt.categoryId;
    if (!userSubjectLatestScores[uid]) {
      userSubjectLatestScores[uid] = {};
    }
    const currentRecorded = userSubjectLatestScores[uid][cid];
    if (!currentRecorded || new Date(attempt.timestamp) >= new Date(currentRecorded.timestamp)) {
      userSubjectLatestScores[uid][cid] = {
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        timestamp: attempt.timestamp
      };
    }
  });

  const candidateOverallAverages = {}; // userId -> { totalMarks, validSubjectsCount, averageMarks, averagePercentage }
  Object.keys(userSubjectLatestScores).forEach(uid => {
    const subjectsMap = userSubjectLatestScores[uid];
    const subjectList = Object.values(subjectsMap);
    const validSubjectsCount = subjectList.length;
    const totalMarks = subjectList.reduce((sum, s) => sum + s.score, 0);
    const totalPercentage = subjectList.reduce((sum, s) => sum + s.percentage, 0);

    candidateOverallAverages[uid] = {
      totalMarks,
      validSubjectsCount,
      averageMarks: validSubjectsCount > 0 ? parseFloat((totalMarks / validSubjectsCount).toFixed(2)) : 0,
      averagePercentage: validSubjectsCount > 0 ? Math.round(totalPercentage / validSubjectsCount) : 0
    };
  });

  // 2. Group attempts by user and quiz/category to compare Latest vs Previous Attempt
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
  let userQuizLogs = Object.values(grouped).map(group => {
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

    const candidateAvg = candidateOverallAverages[group.userId] || {
      totalMarks: latestAttempt ? latestAttempt.score : 0,
      validSubjectsCount: latestAttempt ? 1 : 0,
      averageMarks: latestAttempt ? latestAttempt.score : 0,
      averagePercentage: latestAttempt ? latestAttempt.percentage : 0
    };

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
      scoreImprovement,
      candidateAverage: candidateAvg
    };
  });

  // Optional server-side filtering by subject
  if (subject && subject !== 'all') {
    userQuizLogs = userQuizLogs.filter(log => log.categoryName === subject || log.categoryId === subject);
  }

  // Optional server-side sorting
  if (sortBy === 'highest_marks') {
    userQuizLogs.sort((a, b) => {
      const scoreA = a.latestAttempt ? a.latestAttempt.score : -1;
      const scoreB = b.latestAttempt ? b.latestAttempt.score : -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const pctA = a.latestAttempt ? a.latestAttempt.percentage : -1;
      const pctB = b.latestAttempt ? b.latestAttempt.percentage : -1;
      if (pctB !== pctA) return pctB - pctA;
      return (a.userName || '').localeCompare(b.userName || '');
    });
  } else if (sortBy === 'lowest_marks') {
    userQuizLogs.sort((a, b) => {
      const scoreA = a.latestAttempt ? a.latestAttempt.score : 999;
      const scoreB = b.latestAttempt ? b.latestAttempt.score : 999;
      if (scoreA !== scoreB) return scoreA - scoreB;
      const pctA = a.latestAttempt ? a.latestAttempt.percentage : 999;
      const pctB = b.latestAttempt ? b.latestAttempt.percentage : 999;
      if (pctA !== pctB) return pctA - pctB;
      return (a.userName || '').localeCompare(b.userName || '');
    });
  } else if (sortBy === 'highest_average') {
    userQuizLogs.sort((a, b) => {
      const avgA = a.candidateAverage ? a.candidateAverage.averageMarks : 0;
      const avgB = b.candidateAverage ? b.candidateAverage.averageMarks : 0;
      if (avgB !== avgA) return avgB - avgA;
      const pctA = a.candidateAverage ? a.candidateAverage.averagePercentage : 0;
      const pctB = b.candidateAverage ? b.candidateAverage.averagePercentage : 0;
      if (pctB !== pctA) return pctB - pctA;
      return (a.userName || '').localeCompare(b.userName || '');
    });
  } else {
    // Default: latest attempt timestamp descending
    userQuizLogs.sort((a, b) => {
      const timeA = a.latestAttempt ? new Date(a.latestAttempt.timestamp).getTime() : 0;
      const timeB = b.latestAttempt ? new Date(b.latestAttempt.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }

  // Also include chronological flat attempts list
  const flatAttempts = [...db.attempts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    userQuizLogs,
    candidateOverallAverages,
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
