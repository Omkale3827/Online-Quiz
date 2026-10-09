// routes/questionRoutes.js - Question CRUD Operations

const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../data/db');

// GET /api/questions (with optional ?categoryId=...)
router.get('/', (req, res) => {
  const { categoryId } = req.query;
  const db = getDb();
  let questions = db.questions;

  if (categoryId) {
    questions = questions.filter(q => q.categoryId === categoryId);
  }

  // Attach category details for frontend convenience
  const enhanced = questions.map(q => {
    const cat = db.categories.find(c => c.id === q.categoryId);
    return {
      ...q,
      categoryName: cat ? cat.name : 'Unknown Category'
    };
  });

  res.json(enhanced);
});

// GET /api/questions/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const question = db.questions.find(q => q.id === id);

  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const cat = db.categories.find(c => c.id === question.categoryId);
  res.json({
    ...question,
    categoryName: cat ? cat.name : 'Unknown Category'
  });
});

// POST /api/questions
router.post('/', (req, res) => {
  const { categoryId, questionText, options, correctIndex, explanation } = req.body;

  if (!categoryId || !questionText || !Array.isArray(options) || options.length !== 4) {
    return res.status(400).json({ error: 'Question text, valid categoryId, and 4 options are required' });
  }

  const parsedCorrectIndex = parseInt(correctIndex, 10);
  if (isNaN(parsedCorrectIndex) || parsedCorrectIndex < 0 || parsedCorrectIndex > 3) {
    return res.status(400).json({ error: 'Correct answer index must be between 0 and 3' });
  }

  const db = getDb();
  const categoryExists = db.categories.some(c => c.id === categoryId);
  if (!categoryExists) {
    return res.status(400).json({ error: 'Referenced category does not exist' });
  }

  const newQuestion = {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    categoryId,
    questionText: questionText.trim(),
    options: options.map(opt => String(opt).trim()),
    correctIndex: parsedCorrectIndex,
    explanation: explanation ? explanation.trim() : 'No explanation provided.'
  };

  db.questions.push(newQuestion);
  saveDb(db);

  res.status(201).json(newQuestion);
});

// PUT /api/questions/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { categoryId, questionText, options, correctIndex, explanation } = req.body;

  const db = getDb();
  const idx = db.questions.findIndex(q => q.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Question not found' });
  }

  if (options && (!Array.isArray(options) || options.length !== 4)) {
    return res.status(400).json({ error: 'Options must be an array of exactly 4 strings' });
  }

  let parsedCorrectIndex = db.questions[idx].correctIndex;
  if (correctIndex !== undefined) {
    parsedCorrectIndex = parseInt(correctIndex, 10);
    if (isNaN(parsedCorrectIndex) || parsedCorrectIndex < 0 || parsedCorrectIndex > 3) {
      return res.status(400).json({ error: 'Correct answer index must be between 0 and 3' });
    }
  }

  db.questions[idx] = {
    ...db.questions[idx],
    categoryId: categoryId !== undefined ? categoryId : db.questions[idx].categoryId,
    questionText: questionText !== undefined ? questionText.trim() : db.questions[idx].questionText,
    options: options !== undefined ? options.map(opt => String(opt).trim()) : db.questions[idx].options,
    correctIndex: parsedCorrectIndex,
    explanation: explanation !== undefined ? explanation.trim() : db.questions[idx].explanation
  };

  saveDb(db);
  res.json(db.questions[idx]);
});

// DELETE /api/questions/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const initialLength = db.questions.length;
  db.questions = db.questions.filter(q => q.id !== id);

  if (db.questions.length === initialLength) {
    return res.status(404).json({ error: 'Question not found' });
  }

  saveDb(db);
  res.json({ message: 'Question deleted successfully' });
});

module.exports = router;
