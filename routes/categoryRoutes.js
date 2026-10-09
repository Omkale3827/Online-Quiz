// routes/categoryRoutes.js - Category Management

const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../data/db');

// GET /api/categories
router.get('/', (req, res) => {
  const db = getDb();
  const categoriesWithCounts = db.categories.map(cat => {
    const questionCount = db.questions.filter(q => q.categoryId === cat.id).length;
    return {
      ...cat,
      questionCount
    };
  });
  res.json(categoriesWithCounts);
});

// POST /api/categories (Admin)
router.post('/', (req, res) => {
  const { name, icon, difficulty, description, totalTimeMinutes } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const db = getDb();
  const newCat = {
    id: `cat-${Date.now()}`,
    name: name.trim(),
    icon: icon || 'fa-folder',
    difficulty: difficulty || 'Medium',
    badgeClass: `badge-${(difficulty || 'Medium').toLowerCase()}`,
    description: description || 'Explore quizzes in this topic.',
    totalTimeMinutes: parseInt(totalTimeMinutes, 10) || 5
  };

  db.categories.push(newCat);
  saveDb(db);
  res.status(201).json(newCat);
});

// PUT /api/categories/:id (Admin)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, icon, difficulty, description, totalTimeMinutes } = req.body;

  const db = getDb();
  const catIndex = db.categories.findIndex(c => c.id === id);
  if (catIndex === -1) {
    return res.status(404).json({ error: 'Category not found' });
  }

  db.categories[catIndex] = {
    ...db.categories[catIndex],
    name: name !== undefined ? name.trim() : db.categories[catIndex].name,
    icon: icon !== undefined ? icon : db.categories[catIndex].icon,
    difficulty: difficulty !== undefined ? difficulty : db.categories[catIndex].difficulty,
    badgeClass: `badge-${(difficulty || db.categories[catIndex].difficulty).toLowerCase()}`,
    description: description !== undefined ? description : db.categories[catIndex].description,
    totalTimeMinutes: totalTimeMinutes !== undefined ? parseInt(totalTimeMinutes, 10) : db.categories[catIndex].totalTimeMinutes
  };

  saveDb(db);
  res.json(db.categories[catIndex]);
});

// DELETE /api/categories/:id (Admin)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const initialCatLength = db.categories.length;
  db.categories = db.categories.filter(c => c.id !== id);

  if (db.categories.length === initialCatLength) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Also remove questions and attempts under this category
  db.questions = db.questions.filter(q => q.categoryId !== id);
  db.attempts = db.attempts.filter(a => a.categoryId !== id);

  saveDb(db);
  res.json({ message: 'Category and associated questions deleted successfully' });
});

module.exports = router;
