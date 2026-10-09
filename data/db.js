// data/db.js - JSON File Persistence and Store Helper for OMNIX

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
    return JSON.parse(raw);
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
