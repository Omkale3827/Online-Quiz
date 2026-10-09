// routes/authRoutes.js - Authentication & RBAC

const express = require('express');
const router = express.Router();
const { getDb, saveDb } = require('../data/db');

// Helper to generate simple token
function generateToken(user) {
  return Buffer.from(`${user.id}:${user.email}:${user.role}:${Date.now()}`).toString('base64');
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password, requestedRole } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // If user requested admin login but does not have ROLE_ADMIN
  if (requestedRole === 'ROLE_ADMIN' && user.role !== 'ROLE_ADMIN') {
    return res.status(403).json({ error: 'Access denied: You do not have administrator privileges' });
  }

  const token = generateToken(user);
  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const db = getDb();
  const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (exists) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password,
    role: 'ROLE_USER',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDb(db);

  const token = generateToken(newUser);
  res.status(201).json({
    message: 'Registration successful',
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt
    }
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, email, role] = decoded.split(':');
    const db = getDb();
    const user = db.users.find(u => u.id === userId && u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'User session not found' });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid authorization token' });
  }
});

module.exports = router;
