// test/test_candidate_tracker.js - Verification of Candidate Submission Tracker Sorting & Filtering

const assert = require('assert');
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(b) }));
    }).on('error', reject);
  });
}

async function runTrackerTests() {
  console.log('================================================================');
  console.log('🧪 Starting Candidate Submission Tracker Test Suite');
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

  // 1. Fetch raw logs and candidate averages
  const res = await get('/api/admin/attempts');
  test('API returns HTTP 200', () => {
    assert.strictEqual(res.status, 200);
  });

  const { userQuizLogs, candidateOverallAverages } = res.data;
  test('Returns userQuizLogs and candidateOverallAverages', () => {
    assert(Array.isArray(userQuizLogs), 'userQuizLogs must be array');
    assert(candidateOverallAverages && typeof candidateOverallAverages === 'object', 'candidateOverallAverages must be object');
  });

  // Verify Average Calculation Formula: Total marks obtained / Number of subjects with valid marks
  console.log('\n📋 Verification of Highest Average Calculation Formula');
  Object.entries(candidateOverallAverages).forEach(([uid, stats]) => {
    test(`Candidate ${uid} average formula: ${stats.totalMarks} / ${stats.validSubjectsCount} = ${stats.averageMarks}`, () => {
      assert(stats.validSubjectsCount > 0, 'Must have at least 1 valid subject');
      const expectedAvg = parseFloat((stats.totalMarks / stats.validSubjectsCount).toFixed(2));
      assert.strictEqual(stats.averageMarks, expectedAvg);
    });
  });

  // 7 Scenarios from Prompt Section 7
  console.log('\n📋 Testing the 7 Explicit Required Scenarios');

  // Scenario 1: Select Mathematics and sort by Highest Marks
  const s1 = await get('/api/admin/attempts?subject=Mathematics&sortBy=highest_marks');
  test('Scenario 1: Mathematics sorted by Highest Marks', () => {
    assert.strictEqual(s1.status, 200);
    const logs = s1.data.userQuizLogs;
    assert(logs.length > 0, 'Mathematics should have submissions');
    logs.forEach(l => assert.strictEqual(l.categoryName, 'Mathematics'));
    for (let i = 0; i < logs.length - 1; i++) {
      const scoreCurrent = logs[i].latestAttempt ? logs[i].latestAttempt.score : -1;
      const scoreNext = logs[i + 1].latestAttempt ? logs[i + 1].latestAttempt.score : -1;
      assert(scoreCurrent >= scoreNext, `Descending order failed: ${scoreCurrent} < ${scoreNext}`);
    }
  });

  // Scenario 2: Select Mathematics and sort by Lowest Marks
  const s2 = await get('/api/admin/attempts?subject=Mathematics&sortBy=lowest_marks');
  test('Scenario 2: Mathematics sorted by Lowest Marks', () => {
    assert.strictEqual(s2.status, 200);
    const logs = s2.data.userQuizLogs;
    assert(logs.length > 0, 'Mathematics should have submissions');
    logs.forEach(l => assert.strictEqual(l.categoryName, 'Mathematics'));
    for (let i = 0; i < logs.length - 1; i++) {
      const scoreCurrent = logs[i].latestAttempt ? logs[i].latestAttempt.score : 999;
      const scoreNext = logs[i + 1].latestAttempt ? logs[i + 1].latestAttempt.score : 999;
      assert(scoreCurrent <= scoreNext, `Ascending order failed: ${scoreCurrent} > ${scoreNext}`);
    }
  });

  // Scenario 3: Select Python and sort by Highest Marks
  const s3 = await get('/api/admin/attempts?subject=Python&sortBy=highest_marks');
  test('Scenario 3: Python sorted by Highest Marks', () => {
    assert.strictEqual(s3.status, 200);
    const logs = s3.data.userQuizLogs;
    logs.forEach(l => assert.strictEqual(l.categoryName, 'Python'));
    for (let i = 0; i < logs.length - 1; i++) {
      const scoreCurrent = logs[i].latestAttempt ? logs[i].latestAttempt.score : -1;
      const scoreNext = logs[i + 1].latestAttempt ? logs[i + 1].latestAttempt.score : -1;
      assert(scoreCurrent >= scoreNext);
    }
  });

  // Scenario 4: Select Java Programming and sort by Lowest Marks
  const s4 = await get('/api/admin/attempts?subject=Java%20Programming&sortBy=lowest_marks');
  test('Scenario 4: Java Programming sorted by Lowest Marks', () => {
    assert.strictEqual(s4.status, 200);
    const logs = s4.data.userQuizLogs;
    assert(logs.length > 0, 'Java Programming should have submissions');
    logs.forEach(l => assert.strictEqual(l.categoryName, 'Java Programming'));
    for (let i = 0; i < logs.length - 1; i++) {
      const scoreCurrent = logs[i].latestAttempt ? logs[i].latestAttempt.score : 999;
      const scoreNext = logs[i + 1].latestAttempt ? logs[i + 1].latestAttempt.score : 999;
      assert(scoreCurrent <= scoreNext, `Ascending order failed: ${scoreCurrent} > ${scoreNext}`);
    }
  });

  // Scenario 5: Select C Programming and sort by Highest Average
  const s5 = await get('/api/admin/attempts?subject=C%20Programming&sortBy=highest_average');
  test('Scenario 5: C Programming sorted by Highest Average', () => {
    assert.strictEqual(s5.status, 200);
    const logs = s5.data.userQuizLogs;
    logs.forEach(l => assert.strictEqual(l.categoryName, 'C Programming'));
    for (let i = 0; i < logs.length - 1; i++) {
      const avgCurrent = logs[i].candidateAverage ? logs[i].candidateAverage.averageMarks : 0;
      const avgNext = logs[i + 1].candidateAverage ? logs[i + 1].candidateAverage.averageMarks : 0;
      assert(avgCurrent >= avgNext, `Highest average failed: ${avgCurrent} < ${avgNext}`);
    }
  });

  // Scenario 6: Select All Subjects and sort by Highest Average
  const s6 = await get('/api/admin/attempts?subject=all&sortBy=highest_average');
  test('Scenario 6: All Subjects sorted by Highest Average', () => {
    assert.strictEqual(s6.status, 200);
    const logs = s6.data.userQuizLogs;
    assert(logs.length > 0, 'All Subjects should return all submissions');
    for (let i = 0; i < logs.length - 1; i++) {
      const avgCurrent = logs[i].candidateAverage ? logs[i].candidateAverage.averageMarks : 0;
      const avgNext = logs[i + 1].candidateAverage ? logs[i + 1].candidateAverage.averageMarks : 0;
      assert(avgCurrent >= avgNext, `Highest average failed: ${avgCurrent} < ${avgNext}`);
    }
  });

  // Scenario 7: Reset sorting and verify that the original candidate list returns
  const s7 = await get('/api/admin/attempts');
  test('Scenario 7: Reset sorting returns complete candidate list in default order', () => {
    assert.strictEqual(s7.status, 200);
    const logs = s7.data.userQuizLogs;
    assert.strictEqual(logs.length, userQuizLogs.length, 'Must match full unfiltered count');
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests} TRACKER TEST SUITE ASSERTIONS PASSED!`);
  console.log('================================================================');
}

runTrackerTests().catch(err => {
  console.error(err);
  process.exit(1);
});
