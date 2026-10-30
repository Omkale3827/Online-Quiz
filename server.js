// server.js - QuizCraft Backend Application Server

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const questionRoutes = require('./routes/questionRoutes');
const quizRoutes = require('./routes/quizRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/admin', adminRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'QuizCraft Interactive Quiz Platform',
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for unknown routes if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 QuizCraft Quiz Platform Server Running on Port ${PORT}`);
  console.log(`🌐 Web URL: http://localhost:${PORT}`);
  console.log(`📊 Admin Portal: http://localhost:${PORT}/admin-dashboard.html`);
  console.log(`👤 User Dashboard: http://localhost:${PORT}/user-dashboard.html`);
  console.log(`====================================================`);
});
