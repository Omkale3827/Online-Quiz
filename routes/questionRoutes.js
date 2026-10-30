// routes/questionRoutes.js - Question CRUD & PDF Automatic Import Operations

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb, saveDb } = require('../data/db');
const { extractQuestionsAndGenerateQuizzes, computePdfHash } = require('../services/pdfExtractor');

// Multer memory storage for PDF parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || 
                  (file.originalname && file.originalname.toLowerCase().endsWith('.pdf'));
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only PDF documents (.pdf) are accepted.'));
    }
  }
});

// GET /api/questions (with optional ?categoryId=... or ?quizId=...)
router.get('/', (req, res) => {
  const { categoryId, quizId } = req.query;
  const db = getDb();
  let questions = db.questions;

  if (categoryId) {
    questions = questions.filter(q => q.categoryId === categoryId);
  }

  if (quizId) {
    questions = questions.filter(q => q.quizId === quizId);
  }

  // Attach category details and quiz info for frontend convenience
  const enhanced = questions.map(q => {
    const cat = db.categories.find(c => c.id === q.categoryId);
    const quiz = db.quizzes ? db.quizzes.find(qz => qz.id === q.quizId) : null;
    return {
      ...q,
      categoryName: cat ? cat.name : 'Unknown Category',
      quizTitle: quiz ? quiz.title : (q.quizGroup ? `Quiz ${q.quizGroup}` : 'Standard Quiz')
    };
  });

  res.json(enhanced);
});

// GET /api/questions/quizzes (with optional ?categoryId=...)
router.get('/quizzes', (req, res) => {
  const { categoryId } = req.query;
  const db = getDb();
  let quizzes = db.quizzes || [];

  if (categoryId) {
    quizzes = quizzes.filter(q => q.categoryId === categoryId);
  }

  // Enhance each quiz with actual question count
  const enhanced = quizzes.map(qz => {
    const qCount = db.questions.filter(q => q.quizId === qz.id).length;
    const cat = db.categories.find(c => c.id === qz.categoryId);
    return {
      ...qz,
      questionCount: qCount,
      categoryName: cat ? cat.name : qz.categoryName
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
  const quiz = db.quizzes ? db.quizzes.find(qz => qz.id === question.quizId) : null;
  res.json({
    ...question,
    categoryName: cat ? cat.name : 'Unknown Category',
    quizTitle: quiz ? quiz.title : 'Standard Quiz'
  });
});

// POST /api/questions - Manual Single Question Entry
router.post('/', (req, res) => {
  const { categoryId, questionText, options, correctIndex, explanation, quizId } = req.body;

  if (!categoryId || !questionText || !Array.isArray(options) || options.length !== 4) {
    return res.status(400).json({ error: 'Question text, valid categoryId, and 4 options are required' });
  }

  const parsedCorrectIndex = parseInt(correctIndex, 10);
  if (isNaN(parsedCorrectIndex) || parsedCorrectIndex < 0 || parsedCorrectIndex > 3) {
    return res.status(400).json({ error: 'Correct answer index must be between 0 and 3' });
  }

  const db = getDb();
  const category = db.categories.find(c => c.id === categoryId);
  if (!category) {
    return res.status(400).json({ error: 'Referenced category does not exist' });
  }

  // Find or link quizId
  let targetQuizId = quizId;
  if (!targetQuizId) {
    const existingQuiz = (db.quizzes || []).find(qz => qz.categoryId === categoryId);
    if (existingQuiz) {
      targetQuizId = existingQuiz.id;
    } else {
      targetQuizId = `quiz-${categoryId}-1`;
      if (!db.quizzes) db.quizzes = [];
      db.quizzes.push({
        id: targetQuizId,
        title: 'Quiz 1',
        categoryId,
        categoryName: category.name,
        quizNumber: 1,
        totalQuestions: 1,
        totalTimeMinutes: category.totalTimeMinutes || 5,
        createdAt: new Date().toISOString()
      });
    }
  }

  const newQuestion = {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    categoryId,
    quizId: targetQuizId,
    quizGroup: 1,
    questionText: questionText.trim(),
    options: options.map(opt => String(opt).trim()),
    correctIndex: parsedCorrectIndex,
    explanation: explanation ? explanation.trim() : 'No explanation provided.'
  };

  db.questions.push(newQuestion);

  // Update quiz question count if applicable
  const targetQuiz = (db.quizzes || []).find(qz => qz.id === targetQuizId);
  if (targetQuiz) {
    targetQuiz.totalQuestions = db.questions.filter(q => q.quizId === targetQuizId).length;
  }

  saveDb(db);

  res.status(201).json(newQuestion);
});

// PUT /api/questions/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { categoryId, questionText, options, correctIndex, explanation, quizId } = req.body;

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
    quizId: quizId !== undefined ? quizId : db.questions[idx].quizId,
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
  const targetQuestion = db.questions.find(q => q.id === id);

  if (!targetQuestion) {
    return res.status(404).json({ error: 'Question not found' });
  }

  db.questions = db.questions.filter(q => q.id !== id);

  // Update quiz count if quiz exists
  if (targetQuestion.quizId && db.quizzes) {
    const qz = db.quizzes.find(q => q.id === targetQuestion.quizId);
    if (qz) {
      qz.totalQuestions = db.questions.filter(q => q.quizId === targetQuestion.quizId).length;
    }
  }

  saveDb(db);
  res.json({ message: 'Question deleted successfully' });
});

// ============================================================
// PDF PROCESSING & AUTOMATIC QUIZ GENERATION ENDPOINTS
// ============================================================

// POST /api/questions/extract-pdf
// Uploads PDF, parses questions, divides into 5-question groups, returns extraction preview
router.post('/extract-pdf', (req, res) => {
  upload.single('pdfFile')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a PDF file to upload.' });
    }

    const { categoryId } = req.body;
    if (!categoryId) {
      return res.status(400).json({ error: 'Domain/Category selection is required.' });
    }

    const db = getDb();
    const category = db.categories.find(c => c.id === categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Selected domain/category not found.' });
    }

    try {
      const fileHash = computePdfHash(req.file.buffer);
      
      // Check if this identical PDF was already imported into this domain
      const priorImport = (db.importedPdfs || []).find(
        imp => imp.fileHash === fileHash && imp.categoryId === categoryId
      );

      const extractionResult = await extractQuestionsAndGenerateQuizzes(
        req.file.buffer,
        category.id,
        category.name,
        req.file.originalname
      );

      // Include duplicate advisory if previously imported
      res.json({
        ...extractionResult,
        isDuplicateNotice: Boolean(priorImport),
        priorImportDate: priorImport ? priorImport.timestamp : null
      });

    } catch (parseErr) {
      console.error('PDF Extraction error:', parseErr);
      res.status(422).json({
        error: parseErr.message || 'Failed to extract questions from the PDF.'
      });
    }
  });
});

// POST /api/questions/import-pdf-quizzes
// Confirms extraction preview and saves generated quizzes to DB
router.post('/import-pdf-quizzes', (req, res) => {
  const { categoryId, fileName, fileHash, force, quizzes } = req.body;

  if (!categoryId || !Array.isArray(quizzes) || quizzes.length === 0) {
    return res.status(400).json({ error: 'Invalid payload: categoryId and at least one quiz are required.' });
  }

  const db = getDb();
  const category = db.categories.find(c => c.id === categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Selected domain not found' });
  }

  // Prevent accidental duplicates unless force flag is set
  if (fileHash && !force) {
    const existing = (db.importedPdfs || []).find(
      imp => imp.fileHash === fileHash && imp.categoryId === categoryId
    );
    if (existing) {
      return res.status(409).json({
        error: 'This PDF file was already imported into this domain.',
        isDuplicate: true,
        previousImport: existing
      });
    }
  }

  // Determine current quiz numbering for this category
  const existingCategoryQuizzes = (db.quizzes || []).filter(qz => qz.categoryId === categoryId);
  let nextQuizNumber = existingCategoryQuizzes.length + 1;

  const createdQuizzes = [];
  const createdQuestions = [];

  // Strictly enforce 5 questions per quiz
  for (let qzIdx = 0; qzIdx < quizzes.length; qzIdx++) {
    const qzData = quizzes[qzIdx];
    const questionsList = qzData.questions;

    if (!Array.isArray(questionsList) || questionsList.length !== 5) {
      return res.status(400).json({
        error: `Distribution violation: Every generated quiz must contain exactly 5 questions. "${qzData.quizName || ('Quiz ' + (qzIdx + 1))}" has ${questionsList ? questionsList.length : 0} questions.`
      });
    }

    const quizNumber = nextQuizNumber++;
    const quizId = `quiz-${categoryId}-${Date.now()}-${quizNumber}`;
    const quizTitle = `Quiz ${quizNumber}`;

    const newQuizRecord = {
      id: quizId,
      title: quizTitle,
      categoryId: category.id,
      categoryName: category.name,
      quizNumber,
      totalQuestions: 5,
      totalTimeMinutes: category.totalTimeMinutes || 5,
      sourcePdf: fileName || 'Imported PDF',
      createdAt: new Date().toISOString()
    };

    createdQuizzes.push(newQuizRecord);

    questionsList.forEach((qItem, itemIdx) => {
      const parsedCorrect = parseInt(qItem.correctIndex, 10);
      const newQuestion = {
        id: `q-${Date.now()}-${quizNumber}-${itemIdx + 1}-${Math.floor(Math.random() * 1000)}`,
        categoryId: category.id,
        quizId: quizId,
        quizGroup: quizNumber,
        questionText: String(qItem.questionText || '').trim(),
        options: Array.isArray(qItem.options) ? qItem.options.map(opt => String(opt).trim()) : ['', '', '', ''],
        correctIndex: isNaN(parsedCorrect) ? 0 : parsedCorrect,
        explanation: qItem.explanation ? String(qItem.explanation).trim() : 'No explanation provided.'
      };
      createdQuestions.push(newQuestion);
    });
  }

  // Append quizzes and questions to DB
  if (!db.quizzes) db.quizzes = [];
  db.quizzes.push(...createdQuizzes);
  db.questions.push(...createdQuestions);

  // Track import history to prevent accidental duplicates
  if (!db.importedPdfs) db.importedPdfs = [];
  db.importedPdfs.push({
    fileHash: fileHash || computePdfHash(Buffer.from(fileName + Date.now())),
    fileName: fileName || 'document.pdf',
    categoryId: category.id,
    categoryName: category.name,
    quizzesCreated: createdQuizzes.length,
    questionsSaved: createdQuestions.length,
    timestamp: new Date().toISOString()
  });

  saveDb(db);

  res.status(201).json({
    message: `Successfully generated and saved ${createdQuizzes.length} quiz(zes) containing ${createdQuestions.length} questions in "${category.name}".`,
    quizzes: createdQuizzes,
    questionsCount: createdQuestions.length
  });
});

module.exports = router;
