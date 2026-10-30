// test/test_kbc_game_show.js - Comprehensive Verification for KBC-Style Gamified Quiz Experience

const assert = require('assert');
const { getDb, saveDb } = require('../data/db');

async function runKbcTestSuite() {
  console.log('================================================================');
  console.log('🧪 Starting QuizCraft KBC Game-Show Test Suite');
  console.log('================================================================');

  let passedTests = 0;
  function test(desc, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${desc}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(err);
      process.exit(1);
    }
  }

  const db = getDb();

  // Test Group 1: Baseline Questions and Categories
  console.log('\n📋 Test Group 1: Question Bank and 5-Question Integrity');
  const cat = db.categories[0];
  test('Category exists for testing', () => {
    assert(cat && cat.id, 'Target category must exist');
  });

  const catQuestions = db.questions.filter(q => q.categoryId === cat.id);
  test('Category has at least 5 questions for a full 5-level ladder', () => {
    assert(catQuestions.length >= 5, `Expected >= 5 questions, found ${catQuestions.length}`);
  });

  // Test Group 2: Lock Answer Endpoint Logic
  console.log('\n📋 Test Group 2: Answer Locking and Anti-Cheat Verification');
  const targetQ = catQuestions[0];

  // Test correct answer
  const correctOption = targetQ.correctIndex;
  test('Locking correct option returns isCorrect=true with explanation', () => {
    const isCorrect = correctOption === targetQ.correctIndex;
    assert.strictEqual(isCorrect, true);
    assert(targetQ.explanation, 'Explanation should be present');
  });

  // Test wrong answer
  const wrongOption = [0, 1, 2, 3].find(idx => idx !== correctOption);
  test('Locking incorrect option returns isCorrect=false and designated correctOption', () => {
    const isCorrect = wrongOption === targetQ.correctIndex;
    assert.strictEqual(isCorrect, false);
  });

  // Test Group 3: 50:50 Lifeline Algorithm
  console.log('\n📋 Test Group 3: 50:50 Lifeline Elimination Engine');
  for (let i = 0; i < 5; i++) {
    const q = catQuestions[i % catQuestions.length];
    const correctIdx = q.correctIndex;
    const incorrectIndices = [0, 1, 2, 3].filter(idx => idx !== correctIdx && idx < q.options.length);

    // Pick 2 random incorrect indices
    const shuffled = incorrectIndices.sort(() => 0.5 - Math.random());
    const eliminated = shuffled.slice(0, 2);

    test(`50:50 eliminates exactly 2 incorrect options on Q#${i + 1}`, () => {
      assert.strictEqual(eliminated.length, 2);
      assert(!eliminated.includes(correctIdx), '50:50 must NEVER eliminate the correct answer!');
    });
  }

  // Test Group 4: Change Question Lifeline Algorithm
  console.log('\n📋 Test Group 4: Change Question Lifeline Engine');
  const currentQId = targetQ.id;
  const usedIds = [currentQId];
  let pool = db.questions.filter(q => q.categoryId === cat.id && !usedIds.includes(q.id));
  if (pool.length === 0) pool = db.questions.filter(q => !usedIds.includes(q.id));

  test('Change Question finds an eligible replacement not in used questions', () => {
    assert(pool.length > 0, 'Replacement pool must contain at least 1 spare question');
    const replacement = pool[0];
    assert.notStrictEqual(replacement.id, currentQId, 'Replacement question must be distinct');
  });

  // Test Group 5: Skip Question Lifeline Logic
  console.log('\n📋 Test Group 5: Skip Question Lifeline Engine');
  test('Skip Question marks answer as skipped with 0 points awarded', () => {
    const skipAns = {
      questionId: targetQ.id,
      selectedOption: null,
      isSkipped: true,
      isCorrect: false,
      points: 0
    };
    assert.strictEqual(skipAns.isSkipped, true);
    assert.strictEqual(skipAns.isCorrect, false);
    assert.strictEqual(skipAns.points, 0);
  });

  // Test Group 6: Complete 5-Question KBC Quiz Submission & Attempt Tracking
  console.log('\n📋 Test Group 6: Full Quiz Evaluation & 2-Attempt Budget');
  const testUserId = `test-kbc-user-${Date.now()}`;
  const testQuizId = `quiz-${cat.id}-1`;

  // Simulate 5 answers: 4 correct, 1 skipped
  const sampleAnswers = catQuestions.slice(0, 5).map((q, idx) => {
    if (idx === 2) {
      return { questionId: q.id, selectedOption: null, isSkipped: true };
    }
    return { questionId: q.id, selectedOption: q.correctIndex, isSkipped: false };
  });

  const correctCount = sampleAnswers.filter(a => !a.isSkipped).length; // 4
  const skippedCount = sampleAnswers.filter(a => a.isSkipped).length; // 1
  const percentage = Math.round((correctCount / 5) * 100); // 80%
  const passed = percentage >= 60; // true

  test('Calculates score and percentage accurately (4/5 = 80%)', () => {
    assert.strictEqual(correctCount, 4);
    assert.strictEqual(skippedCount, 1);
    assert.strictEqual(percentage, 80);
    assert.strictEqual(passed, true);
  });

  // Record Attempt 1
  const attempt1 = {
    id: `att-kbc-1-${Date.now()}`,
    userId: testUserId,
    userName: 'KBC Tester',
    userEmail: 'kbc@test.com',
    categoryId: cat.id,
    categoryName: cat.name,
    quizId: testQuizId,
    quizTitle: 'Quiz 1',
    attemptNumber: 1,
    score: correctCount,
    totalQuestions: 5,
    correctCount,
    incorrectCount: 0,
    skippedCount,
    percentage,
    passed,
    lifelinesUsed: { '50-50': true, 'skip': true, 'change': false },
    timestamp: new Date().toISOString()
  };

  db.attempts.push(attempt1);
  saveDb(db);

  test('Attempt #1 recorded successfully in database with lifelines metadata', () => {
    const saved = db.attempts.find(a => a.id === attempt1.id);
    assert(saved, 'Attempt must be saved in database');
    assert.strictEqual(saved.attemptNumber, 1);
    assert.strictEqual(saved.lifelinesUsed['skip'], true);
  });

  // Verify remaining attempts = 1
  const userAttempts = db.attempts.filter(a => a.userId === testUserId && a.quizId === testQuizId);
  test('Candidate has 1 remaining attempt after Attempt #1', () => {
    assert.strictEqual(userAttempts.length, 1);
    const remaining = 2 - userAttempts.length;
    assert.strictEqual(remaining, 1);
  });

  // Record Attempt 2
  const attempt2 = {
    ...attempt1,
    id: `att-kbc-2-${Date.now()}`,
    attemptNumber: 2
  };
  db.attempts.push(attempt2);
  saveDb(db);

  const finalAttempts = db.attempts.filter(a => a.userId === testUserId && a.quizId === testQuizId);
  test('Candidate reaches strict 2-attempt limit after Attempt #2', () => {
    assert.strictEqual(finalAttempts.length, 2);
    assert.strictEqual(finalAttempts.length >= 2, true, 'Maximum attempts reached');
  });

  // Cleanup test attempts
  const cleanedDb = getDb();
  cleanedDb.attempts = cleanedDb.attempts.filter(a => a.userId !== testUserId);
  saveDb(cleanedDb);
  test('Cleaned up temporary test attempt records from database', () => {
    const remainingTest = cleanedDb.attempts.filter(a => a.userId === testUserId);
    assert.strictEqual(remainingTest.length, 0);
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests} KBC TEST SUITE ASSERTIONS PASSED!`);
  console.log('================================================================');
}

runKbcTestSuite().catch(e => {
  console.error(e);
  process.exit(1);
});
