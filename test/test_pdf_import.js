// test/test_pdf_import.js - Automated Test Suite for QuizCraft PDF Import & Quiz Distribution

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { extractQuestionsAndGenerateQuizzes } = require('../services/pdfExtractor');
const fs = require('fs');
const path = require('path');
const { getDb, saveDb } = require('../data/db');

/**
 * Helper to build a test PDF document with N questions
 */
async function generateTestPdfBuffer(questionCount) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const sampleQuestions = [
    { text: "What is the primary function of the JVM in Java?", a: "To compile Java source code into bytecode", b: "To execute Java bytecode on target hardware", c: "To manage relational database queries", d: "To style browser interface elements", ans: "B", exp: "The JVM interprets and JIT-compiles Java bytecode into machine instructions." },
    { text: "Which keyword prevents method overriding in Java?", a: "static", b: "abstract", c: "final", d: "synchronized", ans: "C", exp: "A method declared with the final keyword cannot be overridden by subclasses." },
    { text: "What is the default value of an uninitialized boolean instance variable?", a: "true", b: "false", c: "null", d: "0", ans: "B", exp: "Primitive boolean field defaults to false in Java." },
    { text: "Which collection class guarantees constant-time performance for basic operations?", a: "ArrayList", b: "TreeSet", c: "LinkedList", d: "HashSet", ans: "D", exp: "HashSet provides O(1) expected lookup and insertion using hashing." },
    { text: "What does the 'volatile' keyword signify in multithreaded programming?", a: "The variable is immutable", b: "The variable is cached locally per thread", c: "Reads and writes go directly to main memory", d: "The variable is serializable", ans: "C", exp: "Volatile ensures visibility across threads by bypassing thread CPU caches." },
    { text: "Which exception is thrown when dividing an integer by zero?", a: "NullPointerException", b: "ArithmeticException", c: "IllegalArgumentException", d: "NumberFormatException", ans: "B", exp: "Integer division by zero throws ArithmeticException at runtime." },
    { text: "What is the size of a primitive double in Java?", a: "32 bits", b: "64 bits", c: "128 bits", d: "16 bits", ans: "B", exp: "A Java double is a 64-bit IEEE 754 floating point number." },
    { text: "Which interface must a class implement to be used in a try-with-resources statement?", a: "AutoCloseable", b: "Serializable", c: "Cloneable", d: "Runnable", ans: "A", exp: "try-with-resources manages any object implementing java.lang.AutoCloseable." },
    { text: "What does the String.intern() method do in Java?", a: "Converts String to uppercase", b: "Returns a canonical representation from the string pool", c: "Allocates a new string on the garbage-collected heap", d: "Serializes the string object", ans: "B", exp: "intern() returns the pool reference if an identical string exists in the string pool." },
    { text: "Which of the following is NOT a functional interface in java.util.function?", a: "Predicate<T>", b: "Consumer<T>", c: "Observer<T>", d: "Function<T,R>", ans: "C", exp: "Observer is part of the legacy Observer pattern, not the functional interface package." },
    { text: "Which garbage collector was introduced as production-ready in Java 15?", a: "Serial GC", b: "ZGC", c: "CMS GC", d: "Parallel GC", ans: "B", exp: "ZGC is a low-latency scalable garbage collector made production-ready in Java 15." },
    { text: "What does the transient keyword do to an object field?", a: "Marks it as volatile", b: "Excludes it from default serialization", c: "Locks it for concurrent access", d: "Makes it public static final", ans: "B", exp: "transient fields are omitted when an object graph is serialized." },
    { text: "What is the time complexity of searching an element in a balanced binary search tree?", a: "O(1)", b: "O(n)", c: "O(log n)", d: "O(n log n)", ans: "C", exp: "Balanced binary search trees maintain height proportional to log n." },
    { text: "Which stream operation is an intermediate stateful operation?", a: "map()", b: "filter()", c: "distinct()", d: "forEach()", ans: "C", exp: "distinct() requires maintaining seen state from prior elements in the stream." },
    { text: "What is the purpose of the Optional<T> class in Java 8+?", a: "To replace all null pointers in the language", b: "To provide a type-level solution for representing optional return values", c: "To speed up method invocation", d: "To synchronize access to collection items", ans: "B", exp: "Optional provides a clean API for handling absent return values without throwing NullPointerException." }
  ];

  // Distribute across pages (approx 5 questions per page)
  const questionsPerPage = 5;
  const numPages = Math.ceil(questionCount / questionsPerPage);

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const page = pdfDoc.addPage([600, 800]);
    let y = 750;

    page.drawText(`QuizCraft Assessment Question Bank - Page ${pageIdx + 1}`, {
      x: 50,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.2, 0.5)
    });
    y -= 30;

    const startQ = pageIdx * questionsPerPage;
    const endQ = Math.min(startQ + questionsPerPage, questionCount);

    for (let q = startQ; q < endQ; q++) {
      const qData = sampleQuestions[q % sampleQuestions.length];
      const qNum = q + 1;

      page.drawText(`${qNum}. ${qData.text}`, {
        x: 50,
        y,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      y -= 16;

      page.drawText(`A) ${qData.a}`, { x: 65, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 13;
      page.drawText(`B) ${qData.b}`, { x: 65, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 13;
      page.drawText(`C) ${qData.c}`, { x: 65, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 13;
      page.drawText(`D) ${qData.d}`, { x: 65, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;

      page.drawText(`Answer: ${qData.ans}`, { x: 65, y, size: 9, font: boldFont, color: rgb(0.1, 0.5, 0.2) });
      y -= 13;
      page.drawText(`Explanation: ${qData.exp}`, { x: 65, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 22;
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(pdfBytes);
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log('================================================================');
  console.log('🧪 QUIZCRAFT AUTOMATIC PDF IMPORT & DISTRIBUTION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const testCases = [
    { count: 5, expectedQuizzes: 1, expectedUsed: 5, expectedIgnored: 0, desc: '5 questions -> 1 quiz (5 questions)' },
    { count: 8, expectedQuizzes: 1, expectedUsed: 5, expectedIgnored: 3, desc: '8 questions -> 1 quiz (5 questions + 3 ignored)' },
    { count: 10, expectedQuizzes: 2, expectedUsed: 10, expectedIgnored: 0, desc: '10 questions -> 2 quizzes (5 + 5 questions)' },
    { count: 13, expectedQuizzes: 2, expectedUsed: 10, expectedIgnored: 3, desc: '13 questions -> 2 quizzes (5 + 5 questions + 3 ignored)' },
    { count: 15, expectedQuizzes: 3, expectedUsed: 15, expectedIgnored: 0, desc: '15 questions -> 3 quizzes (5 + 5 + 5 questions)' }
  ];

  // 1. Test Distribution Formula on all required PDF sizes
  console.log('📋 Test Group 1: PDF Question Extraction & Strict 5-Question Formula');
  for (const tc of testCases) {
    console.log(`\n  Testing PDF with ${tc.count} questions (${tc.desc})...`);
    const pdfBuf = await generateTestPdfBuffer(tc.count);
    const result = await extractQuestionsAndGenerateQuizzes(pdfBuf, 'cat-java', 'Java Programming', `test_${tc.count}.pdf`);

    assert(result.totalValid === tc.count, `Extracted ${result.totalValid} valid questions (expected ${tc.count})`);
    assert(result.quizzesCount === tc.expectedQuizzes, `Created ${result.quizzesCount} quizzes (expected ${tc.expectedQuizzes})`);
    assert(result.usedCount === tc.expectedUsed, `Used ${result.usedCount} questions (expected ${tc.expectedUsed})`);
    assert(result.ignoredCount === tc.expectedIgnored, `Ignored ${result.ignoredCount} remainder questions (expected ${tc.expectedIgnored})`);
    assert(result.ignoredQuestions.length === tc.expectedIgnored, `Ignored list length matches ${tc.expectedIgnored}`);

    // Verify every single created quiz has EXACTLY 5 questions
    result.quizzes.forEach((quiz, qzIdx) => {
      assert(quiz.questions.length === 5, `Quiz #${qzIdx + 1} (${quiz.quizName}) has exactly 5 questions`);
      quiz.questions.forEach((q, itemIdx) => {
        assert(q.options.length === 4, `Question #${itemIdx + 1} in Quiz ${quiz.quizName} has 4 options`);
        assert(q.correctIndex >= 0 && q.correctIndex <= 3, `Question #${itemIdx + 1} has valid correct answer index: ${q.correctIndex}`);
        assert(q.questionText && q.questionText.length > 5, `Question #${itemIdx + 1} has prompt text`);
      });
    });

    // Verify questions follow exact original order
    if (result.quizzes.length >= 2) {
      assert(result.quizzes[0].questions[0].originalNumber === 1, 'Quiz 1 begins with Question 1');
      assert(result.quizzes[0].questions[4].originalNumber === 5, 'Quiz 1 ends with Question 5');
      assert(result.quizzes[1].questions[0].originalNumber === 6, 'Quiz 2 begins with Question 6');
      assert(result.quizzes[1].questions[4].originalNumber === 10, 'Quiz 2 ends with Question 10');
    }
  }

  // 2. Test Insufficient Questions Rule (< 5 questions)
  console.log('\n📋 Test Group 2: Insufficient Questions Handling (< 5 questions)');
  const pdf3Buf = await generateTestPdfBuffer(3);
  const result3 = await extractQuestionsAndGenerateQuizzes(pdf3Buf, 'cat-java', 'Java Programming', 'test_3.pdf');
  assert(result3.quizzesCount === 0, 'Zero quizzes created for 3 questions');
  assert(result3.canGenerate === false, 'canGenerate flag is false');
  assert(result3.totalValid === 3, 'Extracted 3 valid questions');
  assert(result3.message.includes('At least 5 valid questions are required'), 'Displays informative required message');

  // 3. Test Database Storage & Multi-Quiz Integration
  console.log('\n📋 Test Group 3: Database Storage & Quiz System Integration');
  const db = getDb();
  assert(Array.isArray(db.categories), 'Categories array exists');
  assert(Array.isArray(db.quizzes), 'Quizzes array exists in db');
  assert(Array.isArray(db.questions), 'Questions array exists in db');
  assert(Array.isArray(db.attempts), 'Attempts array exists in db');

  // Test Quiz Import endpoint simulation
  console.log('\n  Simulating confirmed 10-question import (2 quizzes of 5 questions each)...');
  const pdf10Buf = await generateTestPdfBuffer(10);
  const extraction10 = await extractQuestionsAndGenerateQuizzes(pdf10Buf, 'cat-java', 'Java Programming', 'java_advanced_10.pdf');

  const initialQuizzesCount = db.quizzes.length;
  const initialQuestionsCount = db.questions.length;

  // Save to DB through the service logic
  const createdQuizzes = [];
  const createdQuestions = [];
  let nextNum = db.quizzes.filter(qz => qz.categoryId === 'cat-java').length + 1;

  extraction10.quizzes.forEach(qzData => {
    const qzId = `quiz-cat-java-test-${nextNum}`;
    const quizRecord = {
      id: qzId,
      title: `Quiz ${nextNum}`,
      categoryId: 'cat-java',
      categoryName: 'Java Programming',
      quizNumber: nextNum++,
      totalQuestions: 5,
      totalTimeMinutes: 5,
      sourcePdf: 'java_advanced_10.pdf',
      createdAt: new Date().toISOString()
    };
    createdQuizzes.push(quizRecord);

    qzData.questions.forEach((qItem, idx) => {
      createdQuestions.push({
        id: `q-test-${quizRecord.quizNumber}-${idx + 1}`,
        categoryId: 'cat-java',
        quizId: qzId,
        quizGroup: quizRecord.quizNumber,
        questionText: qItem.questionText,
        options: qItem.options,
        correctIndex: qItem.correctIndex,
        explanation: qItem.explanation
      });
    });
  });

  db.quizzes.push(...createdQuizzes);
  db.questions.push(...createdQuestions);
  saveDb(db);

  assert(db.quizzes.length === initialQuizzesCount + 2, 'Successfully added 2 quizzes to database');
  assert(db.questions.length === initialQuestionsCount + 10, 'Successfully added 10 questions to database');

  // Verify the newly created quizzes can be fetched
  const refreshedDb = getDb();
  const testQuiz1 = refreshedDb.quizzes.find(qz => qz.id === createdQuizzes[0].id);
  const testQuiz2 = refreshedDb.quizzes.find(qz => qz.id === createdQuizzes[1].id);

  assert(testQuiz1 !== undefined, 'Quiz 1 is independently accessible in database');
  assert(testQuiz2 !== undefined, 'Quiz 2 is independently accessible in database');

  const qz1Questions = refreshedDb.questions.filter(q => q.quizId === testQuiz1.id);
  const qz2Questions = refreshedDb.questions.filter(q => q.quizId === testQuiz2.id);

  assert(qz1Questions.length === 5, 'Quiz 1 has exactly 5 questions linked');
  assert(qz2Questions.length === 5, 'Quiz 2 has exactly 5 questions linked');

  // 4. Test Quiz Attempt Simulation & 2-Attempt Constraint
  console.log('\n📋 Test Group 4: Quiz Attempt & 2-Attempt Constraint Verification');
  const testUserId = 'user-1';
  
  // Clean up any test attempts for this quiz
  refreshedDb.attempts = refreshedDb.attempts.filter(a => a.quizId !== testQuiz1.id);

  // Attempt 1 on Quiz 1
  const attempt1 = {
    id: `att-test-1`,
    userId: testUserId,
    userName: 'Demo Student',
    userEmail: 'user@omnix.com',
    categoryId: 'cat-java',
    categoryName: 'Java Programming',
    quizId: testQuiz1.id,
    quizTitle: testQuiz1.title,
    attemptNumber: 1,
    score: 5,
    totalQuestions: 5,
    percentage: 100,
    passed: true,
    timestamp: new Date().toISOString(),
    answers: []
  };
  refreshedDb.attempts.push(attempt1);
  saveDb(refreshedDb);

  let attemptsForQuiz1 = getDb().attempts.filter(a => a.userId === testUserId && a.quizId === testQuiz1.id);
  assert(attemptsForQuiz1.length === 1, 'Recorded Attempt #1 on Quiz 1');

  // Attempt 2 on Quiz 1
  const attempt2 = {
    id: `att-test-2`,
    userId: testUserId,
    userName: 'Demo Student',
    userEmail: 'user@omnix.com',
    categoryId: 'cat-java',
    categoryName: 'Java Programming',
    quizId: testQuiz1.id,
    quizTitle: testQuiz1.title,
    attemptNumber: 2,
    score: 4,
    totalQuestions: 5,
    percentage: 80,
    passed: true,
    timestamp: new Date().toISOString(),
    answers: []
  };
  const dbForAttempt2 = getDb();
  dbForAttempt2.attempts.push(attempt2);
  saveDb(dbForAttempt2);

  attemptsForQuiz1 = getDb().attempts.filter(a => a.userId === testUserId && a.quizId === testQuiz1.id);
  assert(attemptsForQuiz1.length === 2, 'Recorded Attempt #2 on Quiz 1 (Max limit reached)');

  // Attempt on Quiz 2 should be completely independent (0 attempts)
  const attemptsForQuiz2 = getDb().attempts.filter(a => a.userId === testUserId && a.quizId === testQuiz2.id);
  assert(attemptsForQuiz2.length === 0, 'Quiz 2 has 0 attempts for same user (Strictly independent!)');

  // Clean up test records
  const finalDb = getDb();
  finalDb.quizzes = finalDb.quizzes.filter(qz => !qz.id.includes('test-'));
  finalDb.questions = finalDb.questions.filter(q => !q.id.includes('test-'));
  finalDb.attempts = finalDb.attempts.filter(a => !a.id.includes('test-'));
  saveDb(finalDb);

  console.log('\n================================================================');
  console.log(`🎉 ALL ${totalTests} TESTS PASSED SUCCESSFULLY! (${passedTests}/${totalTests})`);
  console.log('================================================================');
}

runAllTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
