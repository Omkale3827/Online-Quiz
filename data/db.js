// data/db.js - JSON File Persistence and Store Helper for QuizCraft

const fs = require('fs');
const path = require('path');
const seedData = require('./seedData');

const DB_FILE = path.join(__dirname, 'db.json');

function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), 'utf-8');
  }
}

function readDb() {
  initDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.quizzes)) {
      data.quizzes = [];
    }
    if (!Array.isArray(data.importedPdfs)) {
      data.importedPdfs = [];
    }

    // Ensure baseline seed quizzes exist for existing categories if quizzes table is empty
    if (data.quizzes.length === 0 && Array.isArray(data.categories)) {
      data.categories.forEach(cat => {
        const catQuestions = data.questions.filter(q => q.categoryId === cat.id);
        const quizId = `quiz-${cat.id}-1`;
        data.quizzes.push({
          id: quizId,
          title: 'Quiz 1',
          categoryId: cat.id,
          categoryName: cat.name,
          quizNumber: 1,
          totalQuestions: catQuestions.length,
          totalTimeMinutes: cat.totalTimeMinutes || 5,
          createdAt: '2026-10-01T00:00:00.000Z'
        });

        catQuestions.forEach(q => {
          if (!q.quizId) q.quizId = quizId;
          if (!q.quizGroup) q.quizGroup = 1;
        });
      });
      writeDb(data);
    }

    return data;
  } catch (err) {
    console.error('Error reading db.json, falling back to seed data', err);
    return JSON.parse(JSON.stringify(seedData));
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to db.json', err);
  }
}

module.exports = {
  getDb: readDb,
  saveDb: writeDb,
  resetDb: () => {
    writeDb(JSON.parse(JSON.stringify(seedData)));
    return readDb();
  }
};
