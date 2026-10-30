// services/pdfExtractor.js - Robust PDF Question & MCQ Extraction Engine

const pdfParse = require('pdf-parse');
const crypto = require('crypto');

/**
 * Clean and normalize text extracted from PDF
 */
function cleanRawPdfText(rawText) {
  if (!rawText) return '';

  return rawText
    // Replace carriage returns with standard newlines
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove null bytes and non-printable characters
    .replace(/\0/g, '')
    // Remove common header / footer pagination noise
    .replace(/Page\s+\d+(\s+of\s+\d+)?/gi, '')
    // Normalize excessive multiple spaces while keeping line breaks
    .replace(/[ \t]+/g, ' ')
    // Normalize multiple blank lines to double newline
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Compute SHA256 hash of PDF buffer for duplicate detection
 */
function computePdfHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Parse text into candidate question blocks and extract components
 */
function parseQuestionsFromText(fullText) {
  if (!fullText || typeof fullText !== 'string') {
    return [];
  }

  const cleanedText = cleanRawPdfText(fullText);
  const lines = cleanedText.split('\n');

  // Regex to detect the start of a new question
  // Matches: "1. ", "1) ", "Q1. ", "Q1: ", "Question 1: ", "Question 1. ", "1 - "
  const questionStartRegex = /^\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d+)[\.\)\:\-]\s+(.+)/i;

  const rawBlocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(questionStartRegex);
    if (match) {
      // Check if this might just be an option or sub-item
      // A new question number should typically be consecutive or distinctly numbered
      const qNum = parseInt(match[1], 10);
      
      // If we have a current block, push it
      if (currentBlock) {
        rawBlocks.push(currentBlock);
      }

      currentBlock = {
        number: qNum,
        rawLines: [line]
      };
    } else {
      if (currentBlock) {
        currentBlock.rawLines.push(line);
      }
    }
  }

  // Push the final block
  if (currentBlock) {
    rawBlocks.push(currentBlock);
  }

  // Check if answer keys are located at the end of the document
  // Format: "Answer Key: 1. A, 2. B, 3. C" or "Answers: 1-A 2-B"
  const answerKeyMap = extractAnswerKeyTable(cleanedText);

  // Now parse each raw block into structured MCQ
  const extractedQuestions = [];

  rawBlocks.forEach((block, blockIndex) => {
    const parsed = parseSingleQuestionBlock(block.rawLines, block.number || (blockIndex + 1), answerKeyMap);
    if (parsed) {
      extractedQuestions.push(parsed);
    }
  });

  return extractedQuestions;
}

/**
 * Parse an answer key section if present at the end of the document
 */
function extractAnswerKeyTable(fullText) {
  const answerKeyMap = new Map();
  const keyHeaderMatch = fullText.search(/(?:Answer\s+Keys?|Solutions?|Answers?)\s*(?:\:|\n)/i);
  if (keyHeaderMatch === -1) return answerKeyMap;

  const keySection = fullText.substring(keyHeaderMatch);
  // Match pairs like "1. A", "1 - B", "1: C", "1) D", "Q1: A"
  const pairRegex = /(?:Q)?(\d+)[\.\:\-\)]\s*([A-Da-d])/g;
  let match;
  while ((match = pairRegex.exec(keySection)) !== null) {
    const qNum = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    const idx = letter.charCodeAt(0) - 65; // A->0, B->1, C->2, D->3
    answerKeyMap.set(qNum, idx);
  }

  return answerKeyMap;
}

/**
 * Parse lines belonging to one question block
 */
function parseSingleQuestionBlock(lines, questionNumber, globalAnswerKeyMap) {
  if (!lines || lines.length === 0) return null;

  const fullBlockText = lines.join('\n');

  // 1. Extract Question Text
  // Find where options start
  // Options typically begin with A), (A), A., [A], a), (a), a.
  const optionStartPattern = /(?:^|\n)\s*(?:\(?([A-Da-d])\)|\b([A-Da-d])[\.\:\]])\s+/;
  const firstOptionMatch = fullBlockText.match(optionStartPattern);

  let questionPrompt = '';
  let restText = fullBlockText;

  if (firstOptionMatch && firstOptionMatch.index !== undefined) {
    questionPrompt = fullBlockText.substring(0, firstOptionMatch.index).trim();
    restText = fullBlockText.substring(firstOptionMatch.index).trim();
  } else {
    // If no option format matched via newline, try to see if options are inline
    questionPrompt = lines[0];
    restText = lines.slice(1).join('\n');
  }

  // Clean question prompt (remove leading "1. ", "Question 1: ", etc.)
  questionPrompt = questionPrompt
    .replace(/^\s*(?:Q(?:uestion)?\s*\.?\s*)?\d+[\.\)\:\-]\s*/i, '')
    .trim();

  // 2. Extract Options A, B, C, D
  const optionsMap = { 0: '', 1: '', 2: '', 3: '' };
  let identifiedCorrectIndex = null;
  let explanation = '';

  // Extract Explanation / Rationale if present
  const explMatch = restText.match(/(?:Explanation|Rationale|Solution|Reason)\s*[\:\-]\s*([\s\S]+)/i);
  if (explMatch) {
    explanation = explMatch[1].trim();
    restText = restText.substring(0, explMatch.index).trim();
  }

  // Extract designated correct answer if explicitly stated
  // Matches: "Answer: B", "Ans: (C)", "Correct Option: A", "Correct Answer: D", "Answer - B"
  const answerMatch = restText.match(/(?:Correct\s+)?(?:Answer|Ans|Option)\s*[\:\-]?\s*(?:\()?([A-Da-d])(?:\))?/i);
  if (answerMatch) {
    const letter = answerMatch[1].toUpperCase();
    identifiedCorrectIndex = letter.charCodeAt(0) - 65;
    // Strip answer line from options text
    restText = restText.replace(answerMatch[0], '').trim();
  }

  // Parse Options (A, B, C, D)
  // Support both line-based and inline options (e.g. A) opt1 B) opt2 C) opt3 D) opt4)
  const optionRegex = /(?:\(?([A-Da-d])\)|\b([A-Da-d])[\.\:\]]|\*([A-Da-d])\)?)\s*([\s\S]*?)(?=(?:\(?([A-Da-d])\)|\b([A-Da-d])[\.\:\]]|\*([A-Da-d])\)?)|$)/g;

  let optMatch;
  let matchesCount = 0;

  while ((optMatch = optionRegex.exec(restText)) !== null) {
    const letter = (optMatch[1] || optMatch[2] || optMatch[3] || '').toUpperCase();
    let text = (optMatch[4] || '').trim();

    if (!letter) continue;
    const index = letter.charCodeAt(0) - 65;

    // Check if option text has an asterisk indicating it is the correct answer
    // e.g. "B) Jupiter *" or "*B) Jupiter"
    if (text.includes('*') || optMatch[0].startsWith('*')) {
      identifiedCorrectIndex = index;
      text = text.replace(/\*/g, '').trim();
    }

    // Clean trailing answer notation if present at end of option
    text = text.replace(/\s*(?:Ans(?:wer)?|Correct)\s*[\:\-].*$/i, '').trim();

    if (index >= 0 && index <= 3) {
      optionsMap[index] = text;
      matchesCount++;
    }
  }

  // Check global answer key map if correct answer wasn't inline
  if (identifiedCorrectIndex === null && globalAnswerKeyMap && globalAnswerKeyMap.has(questionNumber)) {
    identifiedCorrectIndex = globalAnswerKeyMap.get(questionNumber);
  }

  const optionsArray = [
    optionsMap[0] || '',
    optionsMap[1] || '',
    optionsMap[2] || '',
    optionsMap[3] || ''
  ];

  // Validation
  const hasPrompt = questionPrompt.length > 2;
  const hasAllOptions = optionsArray.every(opt => opt && opt.length > 0);
  const hasCorrectAnswer = identifiedCorrectIndex !== null && identifiedCorrectIndex >= 0 && identifiedCorrectIndex <= 3;

  const isValid = hasPrompt && hasAllOptions && hasCorrectAnswer;

  let reviewReason = null;
  if (!hasPrompt) {
    reviewReason = 'Question prompt text is missing or too short';
  } else if (!hasAllOptions) {
    const present = optionsArray.filter(o => o.length > 0).length;
    reviewReason = `Incomplete choices (found ${present} of 4 options)`;
  } else if (!hasCorrectAnswer) {
    reviewReason = 'Designated correct answer could not be identified';
  }

  return {
    originalNumber: questionNumber,
    questionText: questionPrompt,
    options: optionsArray,
    correctIndex: hasCorrectAnswer ? identifiedCorrectIndex : 0,
    hasIdentifiedAnswer: hasCorrectAnswer,
    explanation: explanation || 'No explanation provided.',
    isValid,
    needsReview: !isValid,
    reviewReason
  };
}

/**
 * Main PDF Extraction & 5-Question Grouping Pipeline
 *
 * Formula:
 * Number of quizzes = Total valid extracted questions / 5 (integer division)
 * Remaining questions (< 5) are ignored.
 */
async function extractQuestionsAndGenerateQuizzes(pdfBuffer, domainId, domainName, fileName = 'uploaded.pdf') {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error('Valid PDF buffer is required for processing.');
  }

  const fileHash = computePdfHash(pdfBuffer);

  // Normalize buffer memory to avoid pool sharing offsets in Node.js
  const cleanBuffer = Buffer.isBuffer(pdfBuffer)
    ? new Uint8Array(pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength))
    : pdfBuffer;

  // 1. Extract text using pdf-parse
  let fullText = '';
  try {
    const parseResult = await pdfParse(cleanBuffer);
    fullText = parseResult.text || '';
  } catch (err) {
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }

  // Fallback: If selectable text is empty, check OCR
  if (!fullText || fullText.trim().length < 20) {
    try {
      const Tesseract = require('tesseract.js');
      const ocrResult = await Tesseract.recognize(pdfBuffer, 'eng');
      fullText = ocrResult.data && ocrResult.data.text ? ocrResult.data.text : '';
    } catch (ocrErr) {
      console.warn('OCR fallback attempted but could not process buffer:', ocrErr.message);
    }
  }

  if (!fullText || fullText.trim().length < 20) {
    throw new Error('No readable text or questions could be extracted from this PDF. Please ensure the PDF contains text or legible question content.');
  }

  // 2. Parse questions
  const extractedList = parseQuestionsFromText(fullText);

  if (extractedList.length === 0) {
    throw new Error('No structured MCQ questions were found in the uploaded PDF. Ensure questions follow standard formatting (e.g., 1. Question, A) ... B) ... C) ... D) ..., Answer: X).');
  }

  // Separate valid questions from ones needing review
  const validQuestions = [];
  const invalidQuestions = [];

  extractedList.forEach(q => {
    if (q.isValid) {
      validQuestions.push(q);
    } else {
      invalidQuestions.push(q);
    }
  });

  const totalExtracted = extractedList.length;
  const totalValid = validQuestions.length;

  // 3. Strict 5-Question Distribution Formula:
  // Quizzes = Math.floor(valid / 5)
  const quizzesCount = Math.floor(totalValid / 5);
  const usedCount = quizzesCount * 5;
  const ignoredCount = totalValid - usedCount;

  const canGenerate = quizzesCount >= 1;

  // Divide into groups of exactly 5
  const quizzes = [];
  for (let qIdx = 0; qIdx < quizzesCount; qIdx++) {
    const startIdx = qIdx * 5;
    const endIdx = startIdx + 5;
    const groupQuestions = validQuestions.slice(startIdx, endIdx).map((q, localIdx) => ({
      ...q,
      quizGroupNumber: qIdx + 1,
      quizQuestionNumber: localIdx + 1
    }));

    quizzes.push({
      quizNumber: qIdx + 1,
      quizName: `Quiz ${qIdx + 1}`,
      domainId,
      domainName,
      questionRange: `Questions ${startIdx + 1}–${endIdx}`,
      questions: groupQuestions
    });
  }

  // Ignored questions (Questions after usedCount)
  const ignoredQuestions = validQuestions.slice(usedCount).map((q, idx) => ({
    ...q,
    ignoredReason: 'Excess question beyond complete groups of 5'
  }));

  return {
    fileName,
    fileHash,
    domainId,
    domainName,
    totalExtracted,
    totalValid,
    quizzesCount,
    usedCount,
    ignoredCount,
    canGenerate,
    quizzes,
    ignoredQuestions,
    invalidQuestions,
    allExtracted: extractedList,
    message: canGenerate
      ? `Successfully analyzed PDF: extracted ${totalValid} valid questions, creating ${quizzesCount} quiz(zes) of 5 questions each (${ignoredCount} question(s) ignored).`
      : `Extracted ${totalValid} valid questions. At least 5 valid questions are required to form a quiz (0 quizzes generated).`
  };
}

module.exports = {
  extractQuestionsAndGenerateQuizzes,
  parseQuestionsFromText,
  computePdfHash,
  cleanRawPdfText
};
