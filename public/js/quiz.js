// public/js/quiz.js - Gamified KBC-Style Championship Assessment Engine for QuizCraft

const LEVEL_POINTS = [1000, 2500, 5000, 10000, 25000];
const LEVEL_TITLES = ['Level 1', 'Level 2', 'Level 3 (Safe Haven)', 'Level 4', 'Level 5 (Jackpot)'];
const TIMER_TOTAL_SECONDS = 45;
const CIRCUMFERENCE = 2 * Math.PI * 34; // approx 213.628

let gameState = {
  categoryId: null,
  quizId: null,
  category: null,
  quiz: null,
  questions: [], // 5 questions
  currentLevelIndex: 0, // 0 to 4
  selectedOptionIndex: null, // 0 to 3
  isLocked: false,
  lockedAnswers: {}, // questionId -> { selectedOption, isCorrect, correctOption, explanation, isSkipped, points }
  lifelines: {
    '50-50': { used: false },
    'skip': { used: false },
    'change': { used: false }
  },
  timerInterval: null,
  remainingSeconds: TIMER_TOTAL_SECONDS,
  totalPointsEarned: 0,
  isSubmitted: false,
  submittingLock: false
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.guard()) return;

  // Initialize sound mute state display
  updateSoundButtonUI();

  const urlParams = new URLSearchParams(window.location.search);
  const categoryId = urlParams.get('categoryId');
  const quizId = urlParams.get('quizId');
  const reviewAttemptId = urlParams.get('reviewAttemptId');

  if (!categoryId && !reviewAttemptId) {
    showToast('No quiz selected', 'warning');
    setTimeout(() => { window.location.href = 'user-dashboard.html'; }, 1000);
    return;
  }

  // If in review mode for a completed attempt
  if (reviewAttemptId) {
    await renderPastAttemptReview(reviewAttemptId);
    return;
  }

  // Active quiz mode: verify attempts and initialize
  gameState.categoryId = categoryId;
  gameState.quizId = quizId;
  await initKbcQuizRoom(categoryId, quizId);
});

// Audio Toggle Button
function toggleAudioMute() {
  if (window.soundFX) {
    const isMuted = window.soundFX.toggleMute();
    updateSoundButtonUI();
    if (!isMuted) {
      window.soundFX.playSelect();
    }
  }
}

function updateSoundButtonUI() {
  const isMuted = window.soundFX ? window.soundFX.getMuted() : false;
  const btn = document.getElementById('btn-sound-toggle');
  const icon = document.getElementById('sound-icon');
  const text = document.getElementById('sound-text');
  if (!btn || !icon) return;

  if (isMuted) {
    btn.className = 'kbc-sound-btn muted';
    icon.className = 'fa-solid fa-volume-xmark';
    if (text) text.textContent = 'Muted';
  } else {
    btn.className = 'kbc-sound-btn';
    icon.className = 'fa-solid fa-volume-high';
    if (text) text.textContent = 'Sound ON';
  }
}

// Exit assessment safety confirmation
function confirmExit() {
  if (gameState.isSubmitted) return true;
  return confirm('Are you sure you want to exit the championship arena? Any unsubmitted progress will be lost.');
}

// Session Cache Helpers for Refresh & Disconnection Recovery
function getSessionStorageKey() {
  const user = API.getUser();
  const uid = user ? user.id : 'anon';
  return `quizcraft_kbc_session_${uid}_${gameState.categoryId}_${gameState.quizId || 'default'}`;
}

function saveLocalSessionState() {
  try {
    const payload = {
      currentLevelIndex: gameState.currentLevelIndex,
      lockedAnswers: gameState.lockedAnswers,
      lifelines: gameState.lifelines,
      totalPointsEarned: gameState.totalPointsEarned,
      questions: gameState.questions
    };
    localStorage.setItem(getSessionStorageKey(), JSON.stringify(payload));
  } catch (e) {
    console.warn('Unable to cache local session state', e);
  }
}

function clearLocalSessionState() {
  try {
    localStorage.removeItem(getSessionStorageKey());
  } catch (e) {}
}

function loadLocalSessionState() {
  try {
    const raw = localStorage.getItem(getSessionStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// --- Initialize Quiz Room & Check Attempts ---
async function initKbcQuizRoom(categoryId, quizId = null) {
  try {
    // 1. Check attempt restriction
    const status = await API.getQuizStatus(categoryId, null, quizId);
    if (status.isMaxReached) {
      alert('Maximum attempts reached (2/2) for this quiz. You cannot take this quiz again.');
      window.location.href = 'user-dashboard.html';
      return;
    }

    // 2. Fetch quiz questions
    const quizData = await API.getQuizQuestions(categoryId, quizId);
    gameState.category = quizData.category;
    gameState.quiz = quizData.quiz;
    gameState.questions = quizData.questions;

    // Check if cached session exists (e.g. from page refresh)
    const cached = loadLocalSessionState();
    if (cached && cached.questions && cached.questions.length === quizData.questions.length) {
      gameState.questions = cached.questions;
      gameState.lockedAnswers = cached.lockedAnswers || {};
      gameState.lifelines = cached.lifelines || gameState.lifelines;
      gameState.totalPointsEarned = cached.totalPointsEarned || 0;
      gameState.currentLevelIndex = cached.currentLevelIndex || 0;
      console.log('Restored in-progress championship session from local cache');
    }

    // Update Header and Welcome UI
    const quizTitle = quizData.quiz && quizData.quiz.title ? quizData.quiz.title : 'Quiz 1';
    document.getElementById('nav-subject-title').textContent = quizData.category.name;
    document.getElementById('nav-quiz-title').textContent = `${quizTitle} • 5-Question Championship Ladder`;

    document.getElementById('welcome-subject-name').textContent = quizData.category.name;
    document.getElementById('welcome-quiz-title').textContent = `${quizTitle} — Kaun Banega Assessment Champion`;

    document.getElementById('hud-category-name').textContent = `${quizData.category.name} (${quizTitle})`;

    // Check if session was already in-progress
    if (Object.keys(gameState.lockedAnswers).length > 0) {
      startKbcQuiz(true); // resume directly
    }

  } catch (error) {
    console.error('Quiz init error:', error);
    alert(error.message || 'Unable to load quiz arena');
    window.location.href = 'user-dashboard.html';
  }
}

// --- Start Quiz (Entering the Hot Seat) ---
function startKbcQuiz(isResume = false) {
  if (window.soundFX) {
    window.soundFX.init();
    if (!isResume) {
      window.soundFX.playStart();
    }
  }

  // Switch from welcome view to game stage
  document.getElementById('kbc-welcome-view').classList.add('d-none');
  document.getElementById('kbc-game-stage').classList.remove('d-none');

  // Update lifeline button states
  updateLifelineButtonsUI();

  // Load current level question
  loadLevelQuestion(gameState.currentLevelIndex);
}

// --- Load Question for Current Level ---
function loadLevelQuestion(levelIndex) {
  const total = gameState.questions.length;
  if (levelIndex >= total) {
    // All questions finished, finalize
    finalizeAndSubmitQuiz();
    return;
  }

  gameState.currentLevelIndex = levelIndex;
  gameState.selectedOptionIndex = null;
  gameState.isLocked = false;

  const currentQ = gameState.questions[levelIndex];
  const levelNum = levelIndex + 1;
  const levelPoints = LEVEL_POINTS[levelIndex] || 1000;

  // Update HUD
  document.getElementById('hud-level-badge').textContent = `LEVEL ${levelNum} / ${total}`;
  document.getElementById('hud-level-points').textContent = `Value: ${levelPoints.toLocaleString()} Points`;

  // Update Question Box
  document.getElementById('q-number-pill').textContent = `QUESTION ${levelNum}`;
  document.getElementById('q-diff-badge').textContent = levelNum >= 4 ? 'Advanced' : levelNum >= 3 ? 'Intermediate' : 'Foundational';
  document.getElementById('kbc-question-text').textContent = currentQ.questionText;

  // Hide feedback box & Next button
  document.getElementById('kbc-feedback-box').classList.add('d-none');
  document.getElementById('btn-next-level').classList.add('d-none');

  // Reset Lock Button
  const lockBtn = document.getElementById('btn-lock-choice');
  lockBtn.disabled = true;
  lockBtn.innerHTML = '<i class="fa-solid fa-lock me-1"></i> Lock Answer';
  lockBtn.classList.remove('d-none');

  document.getElementById('kbc-hint-text').textContent = 'Select an option, then press Lock Answer';

  // Render 4 Answer Options
  renderOptionButtons(currentQ);

  // Update Ladder
  updateQuestionLadderUI();

  // If this question was already locked in cached session, restore locked display
  const pastLocked = gameState.lockedAnswers[currentQ.id];
  if (pastLocked) {
    restoreLockedQuestionDisplay(pastLocked);
  } else {
    // Start countdown timer for this question
    startQuestionTimer();
  }
}

// --- Render 4 Answer Option Buttons ---
function renderOptionButtons(question) {
  const letters = ['A', 'B', 'C', 'D'];
  const grid = document.getElementById('kbc-options-grid');
  grid.innerHTML = '';

  question.options.forEach((optText, idx) => {
    const btn = document.createElement('div');
    btn.className = 'kbc-option-btn';
    btn.id = `kbc-option-${idx}`;
    btn.setAttribute('data-option-idx', idx);

    btn.innerHTML = `
      <div class="kbc-option-letter" id="kbc-opt-letter-${idx}">${letters[idx]}</div>
      <div class="kbc-option-text">${optText}</div>
      <div class="ms-auto option-status-icon d-none" id="kbc-opt-icon-${idx}">
        <i class="fa-solid fa-check fs-5"></i>
      </div>
    `;

    btn.onclick = () => selectOption(idx);
    grid.appendChild(btn);
  });
}

// --- Select an Option ---
function selectOption(optIndex) {
  if (gameState.isLocked) return;

  const currentQ = gameState.questions[gameState.currentLevelIndex];
  if (gameState.lockedAnswers[currentQ.id]) return;

  gameState.selectedOptionIndex = optIndex;

  // Play selection audio
  if (window.soundFX) window.soundFX.playSelect();

  // Update button visual styles
  const allBtns = document.querySelectorAll('.kbc-option-btn');
  allBtns.forEach((btn, idx) => {
    if (idx === optIndex) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });

  // Enable Lock button
  const lockBtn = document.getElementById('btn-lock-choice');
  lockBtn.disabled = false;
  document.getElementById('kbc-hint-text').textContent = `Option ${['A','B','C','D'][optIndex]} selected. Click Lock Answer to confirm!`;
}

// --- Lock Answer Mechanism ---
async function confirmLockAnswer() {
  if (gameState.isLocked || gameState.selectedOptionIndex === null) return;
  gameState.isLocked = true;

  // Stop the timer
  stopQuestionTimer();

  const currentQ = gameState.questions[gameState.currentLevelIndex];
  const selectedIdx = gameState.selectedOptionIndex;
  const levelPoints = LEVEL_POINTS[gameState.currentLevelIndex] || 1000;

  // Play lock suspense sound
  if (window.soundFX) window.soundFX.playLock();

  // Lock button UI state
  const lockBtn = document.getElementById('btn-lock-choice');
  lockBtn.disabled = true;
  lockBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Locking Choice...';

  // Highlight selected button as locked
  const selectedBtn = document.getElementById(`kbc-option-${selectedIdx}`);
  if (selectedBtn) {
    selectedBtn.classList.remove('selected');
    selectedBtn.classList.add('locked');
  }

  // Disable lifelines while locked
  disableAllLifelines(true);

  try {
    // Call backend to securely evaluate this single answer
    const evalResult = await API.lockAnswer(gameState.categoryId, currentQ.id, selectedIdx, false);

    // Record answer
    const answerRecord = {
      questionId: currentQ.id,
      selectedOption: selectedIdx,
      isCorrect: evalResult.isCorrect,
      correctOption: evalResult.correctOption,
      explanation: evalResult.explanation,
      isSkipped: false,
      points: evalResult.isCorrect ? levelPoints : 0
    };
    gameState.lockedAnswers[currentQ.id] = answerRecord;
    if (evalResult.isCorrect) {
      gameState.totalPointsEarned += levelPoints;
    }

    // Save session locally to prevent data loss on refresh
    saveLocalSessionState();

    // Dramatic reveal delay for game-show suspense (400ms)
    setTimeout(() => {
      revealAnswerEvaluation(answerRecord, levelPoints);
    }, 400);

  } catch (error) {
    console.error('Answer lock error:', error);
    // Show retry modal
    showSyncErrorModal('Unable to record your answer with the server. Your answer is preserved locally.', () => {
      gameState.isLocked = false;
      confirmLockAnswer();
    });
  }
}

// --- Reveal Answer Evaluation ---
function revealAnswerEvaluation(record, levelPoints) {
  const selectedBtn = document.getElementById(`kbc-option-${record.selectedOption}`);
  const correctBtn = document.getElementById(`kbc-option-${record.correctOption}`);

  if (record.isCorrect) {
    // Triumph!
    if (window.soundFX) window.soundFX.playCorrect();
    if (selectedBtn) {
      selectedBtn.classList.remove('locked');
      selectedBtn.classList.add('correct');
      const icon = document.getElementById(`kbc-opt-icon-${record.selectedOption}`);
      if (icon) {
        icon.className = 'ms-auto option-status-icon text-white';
        icon.innerHTML = '<i class="fa-solid fa-circle-check fs-5"></i>';
      }
    }
  } else {
    // Incorrect
    if (window.soundFX) window.soundFX.playIncorrect();
    if (selectedBtn) {
      selectedBtn.classList.remove('locked');
      selectedBtn.classList.add('wrong');
      const icon = document.getElementById(`kbc-opt-icon-${record.selectedOption}`);
      if (icon) {
        icon.className = 'ms-auto option-status-icon text-white';
        icon.innerHTML = '<i class="fa-solid fa-circle-xmark fs-5"></i>';
      }
    }
    // Highlight actual correct answer in green
    if (correctBtn) {
      correctBtn.classList.add('correct');
      const correctIcon = document.getElementById(`kbc-opt-icon-${record.correctOption}`);
      if (correctIcon) {
        correctIcon.className = 'ms-auto option-status-icon text-white';
        correctIcon.innerHTML = '<span class="badge bg-success text-white rounded-pill px-2 py-1">Correct Answer</span>';
      }
    }
  }

  // Update Feedback Box
  const feedbackBox = document.getElementById('kbc-feedback-box');
  const statusBadge = document.getElementById('feedback-status-badge');
  const pointsBadge = document.getElementById('feedback-points-awarded');
  const explanationText = document.getElementById('feedback-explanation-text');

  if (record.isCorrect) {
    statusBadge.innerHTML = '<span class="badge bg-success text-white px-3 py-1.5 rounded-pill"><i class="fa-solid fa-check me-1"></i> Correct Answer!</span>';
    pointsBadge.className = 'text-success small fw-bold font-monospace';
    pointsBadge.textContent = `+${levelPoints.toLocaleString()} Points`;
  } else {
    statusBadge.innerHTML = '<span class="badge bg-danger text-white px-3 py-1.5 rounded-pill"><i class="fa-solid fa-xmark me-1"></i> Incorrect Answer</span>';
    pointsBadge.className = 'text-muted small fw-bold font-monospace';
    pointsBadge.textContent = '+0 Points';
  }
  explanationText.innerHTML = `<strong>Rationale:</strong> ${record.explanation}`;
  feedbackBox.classList.remove('d-none');

  // Hide Lock button, show Next Level button
  const lockBtn = document.getElementById('btn-lock-choice');
  lockBtn.classList.add('d-none');

  const nextBtn = document.getElementById('btn-next-level');
  nextBtn.classList.remove('d-none');

  const isFinalLevel = gameState.currentLevelIndex === gameState.questions.length - 1;
  if (isFinalLevel) {
    nextBtn.innerHTML = '<span>Complete & View Final Results</span> <i class="fa-solid fa-trophy ms-1"></i>';
  } else {
    const nextLevelNum = gameState.currentLevelIndex + 2;
    nextBtn.innerHTML = `<span>Proceed to Level ${nextLevelNum}</span> <i class="fa-solid fa-arrow-right ms-1"></i>`;
  }

  // Update Ladder UI
  updateQuestionLadderUI();
}

// Restore display for previously locked question (on reload)
function restoreLockedQuestionDisplay(record) {
  stopQuestionTimer();
  gameState.isLocked = true;
  gameState.selectedOptionIndex = record.selectedOption;

  revealAnswerEvaluation(record, record.points || 0);
}

// --- Proceed to Next Level ---
function proceedToNextLevel() {
  if (window.soundFX) window.soundFX.playSelect();
  loadLevelQuestion(gameState.currentLevelIndex + 1);
}

// --- Question Ladder UI Engine ---
function updateQuestionLadderUI() {
  const currentIdx = gameState.currentLevelIndex;
  const ladderSteps = document.querySelectorAll('.kbc-ladder-step');

  let totalCorrect = 0;

  ladderSteps.forEach((step) => {
    const levelNum = parseInt(step.getAttribute('data-level'), 10);
    const stepIdx = levelNum - 1;
    const qAtStep = gameState.questions[stepIdx];
    const isPast = qAtStep && gameState.lockedAnswers[qAtStep.id];

    // Reset base classes
    step.className = 'kbc-ladder-step';
    if (levelNum === 3 || levelNum === 5) {
      step.classList.add('milestone');
    }

    const iconSpan = step.querySelector('.step-icon');

    if (isPast) {
      const pastAns = gameState.lockedAnswers[qAtStep.id];
      if (pastAns.isCorrect) {
        step.classList.add('completed');
        if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-circle-check text-success"></i>';
        totalCorrect++;
      } else if (pastAns.isSkipped) {
        step.classList.add('skipped');
        if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-forward text-muted"></i>';
      } else {
        step.classList.add('wrong');
        if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-circle-xmark text-danger"></i>';
      }
    } else if (stepIdx === currentIdx) {
      step.classList.add('active');
      if (iconSpan) iconSpan.innerHTML = '<i class="fa-solid fa-caret-right text-warning fs-5"></i>';
    } else {
      if (iconSpan) {
        if (levelNum === 5) iconSpan.innerHTML = '<i class="fa-solid fa-crown text-warning"></i>';
        else if (levelNum === 3) iconSpan.innerHTML = '<i class="fa-solid fa-shield-halved text-warning"></i>';
        else iconSpan.innerHTML = '<i class="fa-regular fa-circle text-muted"></i>';
      }
    }
  });

  const ladderScore = document.getElementById('ladder-score-badge');
  if (ladderScore) ladderScore.textContent = `${totalCorrect} / ${gameState.questions.length}`;
}

// --- 45-Second Question Timer ---
function startQuestionTimer() {
  stopQuestionTimer();

  gameState.remainingSeconds = TIMER_TOTAL_SECONDS;
  updateTimerVisual(TIMER_TOTAL_SECONDS);

  gameState.timerInterval = setInterval(() => {
    gameState.remainingSeconds--;

    if (gameState.remainingSeconds <= 0) {
      stopQuestionTimer();
      handleQuestionTimeout();
      return;
    }

    updateTimerVisual(gameState.remainingSeconds);

    // Audio effects: ticks on each second, urgent ticks under 10s
    if (window.soundFX) {
      if (gameState.remainingSeconds <= 8) {
        window.soundFX.playUrgentTick();
      } else if (gameState.remainingSeconds <= 15) {
        window.soundFX.playTick();
      }
    }

  }, 1000);
}

function stopQuestionTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}

function updateTimerVisual(seconds) {
  const display = document.getElementById('timer-display-num');
  const ring = document.getElementById('timer-ring-circle');
  if (!display || !ring) return;

  display.textContent = seconds;

  // SVG stroke dashoffset calculation
  const progressRatio = seconds / TIMER_TOTAL_SECONDS;
  const offset = CIRCUMFERENCE * (1 - progressRatio);
  ring.style.strokeDashoffset = offset;

  // Color classes
  ring.className = 'kbc-timer-progress';
  display.className = 'kbc-timer-number';

  if (seconds <= 8) {
    ring.classList.add('timer-danger');
    display.classList.add('timer-danger');
  } else if (seconds <= 18) {
    ring.classList.add('timer-warning');
  }
}

// Timeout handler (when time expires before locking)
async function handleQuestionTimeout() {
  if (gameState.isLocked) return;

  // If candidate had selected an option before timeout, auto-lock that option!
  if (gameState.selectedOptionIndex !== null) {
    showToast('Time is up! Your selected option was locked in.', 'warning');
    confirmLockAnswer();
  } else {
    // Treat as timed out / skipped
    showToast('Time expired! Question marked as unattempted.', 'danger');
    if (window.soundFX) window.soundFX.playIncorrect();

    const currentQ = gameState.questions[gameState.currentLevelIndex];
    gameState.isLocked = true;

    try {
      const evalResult = await API.lockAnswer(gameState.categoryId, currentQ.id, null, true);
      const answerRecord = {
        questionId: currentQ.id,
        selectedOption: null,
        isCorrect: false,
        correctOption: evalResult.correctOption,
        explanation: 'Time expired without answer selection.',
        isSkipped: true,
        points: 0
      };
      gameState.lockedAnswers[currentQ.id] = answerRecord;
      saveLocalSessionState();

      revealAnswerEvaluation(answerRecord, 0);
    } catch (e) {
      console.error('Timeout recording error', e);
    }
  }
}

// ==========================================================================
// LIFELINES IMPLEMENTATION
// ==========================================================================

function updateLifelineButtonsUI() {
  ['50-50', 'skip', 'change'].forEach(type => {
    const isUsed = gameState.lifelines[type].used;
    const btn = document.getElementById(`btn-lifeline-${type}`);
    const badge = document.getElementById(`badge-count-${type}`);
    if (btn) {
      if (isUsed) {
        btn.classList.add('used');
        btn.disabled = true;
      } else {
        btn.classList.remove('used');
        btn.disabled = false;
      }
    }
    if (badge) {
      badge.textContent = isUsed ? '0' : '1';
    }
  });
}

function disableAllLifelines(disabled) {
  ['50-50', 'skip', 'change'].forEach(type => {
    const btn = document.getElementById(`btn-lifeline-${type}`);
    if (btn) {
      if (disabled) {
        btn.disabled = true;
      } else {
        btn.disabled = gameState.lifelines[type].used;
      }
    }
  });
}

// --- Lifeline 1: 50:50 ---
async function use5050Lifeline() {
  if (gameState.isLocked || gameState.lifelines['50-50'].used) return;

  const currentQ = gameState.questions[gameState.currentLevelIndex];

  try {
    if (window.soundFX) window.soundFX.playLifeline();

    const res = await API.useLifeline5050(gameState.categoryId, currentQ.id);
    const eliminated = res.eliminatedIndices || [];

    // Fade out and strike out eliminated options
    eliminated.forEach(idx => {
      const optBtn = document.getElementById(`kbc-option-${idx}`);
      if (optBtn) {
        optBtn.classList.add('eliminated');
      }
    });

    gameState.lifelines['50-50'].used = true;
    updateLifelineButtonsUI();
    saveLocalSessionState();
    showToast('50:50 Activated: Two incorrect options eliminated!', 'info');

  } catch (error) {
    showToast('Failed to activate 50:50 lifeline', 'warning');
  }
}

// --- Lifeline 2: Skip Question ---
async function useSkipLifeline() {
  if (gameState.isLocked || gameState.lifelines['skip'].used) return;

  const currentQ = gameState.questions[gameState.currentLevelIndex];

  if (!confirm('Are you sure you want to skip this question? You will earn 0 points for this level, and your answer will not be counted.')) {
    return;
  }

  stopQuestionTimer();
  gameState.isLocked = true;

  if (window.soundFX) window.soundFX.playLifeline();

  try {
    const res = await API.lockAnswer(gameState.categoryId, currentQ.id, null, true);

    const record = {
      questionId: currentQ.id,
      selectedOption: null,
      isCorrect: false,
      correctOption: null, // Keep hidden until final review per instructions
      explanation: 'Question was skipped using the Skip Question Lifeline.',
      isSkipped: true,
      points: 0
    };

    gameState.lockedAnswers[currentQ.id] = record;
    gameState.lifelines['skip'].used = true;
    updateLifelineButtonsUI();
    saveLocalSessionState();

    // Show feedback
    const feedbackBox = document.getElementById('kbc-feedback-box');
    const statusBadge = document.getElementById('feedback-status-badge');
    const pointsBadge = document.getElementById('feedback-points-awarded');
    const explanationText = document.getElementById('feedback-explanation-text');

    statusBadge.innerHTML = '<span class="badge bg-secondary text-white px-3 py-1.5 rounded-pill"><i class="fa-solid fa-forward me-1"></i> Question Skipped</span>';
    pointsBadge.className = 'text-muted small fw-bold font-monospace';
    pointsBadge.textContent = '+0 Points';
    explanationText.textContent = 'Question was skipped using Lifeline. Correct answer will be displayed in the final review.';
    feedbackBox.classList.remove('d-none');

    // Controls
    document.getElementById('btn-lock-choice').classList.add('d-none');
    const nextBtn = document.getElementById('btn-next-level');
    nextBtn.classList.remove('d-none');

    const isFinalLevel = gameState.currentLevelIndex === gameState.questions.length - 1;
    if (isFinalLevel) {
      nextBtn.innerHTML = '<span>Complete & View Final Results</span> <i class="fa-solid fa-trophy ms-1"></i>';
    } else {
      nextBtn.innerHTML = `<span>Proceed to Level ${gameState.currentLevelIndex + 2}</span> <i class="fa-solid fa-arrow-right ms-1"></i>`;
    }

    updateQuestionLadderUI();
    showToast('Question skipped successfully!', 'info');

  } catch (error) {
    gameState.isLocked = false;
    showToast('Failed to skip question', 'warning');
  }
}

// --- Lifeline 3: Change Question ---
async function useChangeLifeline() {
  if (gameState.isLocked || gameState.lifelines['change'].used) return;

  const currentQ = gameState.questions[gameState.currentLevelIndex];
  const usedQIds = gameState.questions.map(q => q.id);

  if (!confirm('Are you sure you want to change this question with another question from this subject?')) {
    return;
  }

  if (window.soundFX) window.soundFX.playLifeline();

  try {
    const res = await API.useLifelineChange(gameState.categoryId, currentQ.id, usedQIds);
    if (!res.newQuestion) {
      showToast('No eligible replacement question available in this domain', 'warning');
      return;
    }

    // Replace current question with new replacement question
    gameState.questions[gameState.currentLevelIndex] = res.newQuestion;
    gameState.lifelines['change'].used = true;
    updateLifelineButtonsUI();

    // Reload question stage with new question
    loadLevelQuestion(gameState.currentLevelIndex);
    saveLocalSessionState();

    showToast('Question swapped with a new eligible question!', 'success');

  } catch (error) {
    showToast(error.message || 'Failed to change question', 'warning');
  }
}

// ==========================================================================
// FINAL ASSESSMENT SUBMISSION & PODIUM RESULTS
// ==========================================================================

async function finalizeAndSubmitQuiz() {
  if (gameState.isSubmitted || gameState.submittingLock) return;
  gameState.submittingLock = true;

  stopQuestionTimer();

  const loadingOverlay = document.getElementById('kbc-loading-overlay');
  if (loadingOverlay) loadingOverlay.classList.remove('d-none');

  try {
    // Format answers array
    const formattedAnswers = gameState.questions.map(q => {
      const locked = gameState.lockedAnswers[q.id];
      return {
        questionId: q.id,
        selectedOption: locked && !locked.isSkipped ? locked.selectedOption : null,
        isSkipped: !!(locked && locked.isSkipped)
      };
    });

    const lifelinesUsedPayload = {
      '50-50': gameState.lifelines['50-50'].used,
      'skip': gameState.lifelines['skip'].used,
      'change': gameState.lifelines['change'].used
    };

    const response = await API.submitQuiz(
      gameState.categoryId,
      formattedAnswers,
      gameState.quizId,
      lifelinesUsedPayload
    );

    gameState.isSubmitted = true;
    clearLocalSessionState();

    if (loadingOverlay) loadingOverlay.classList.add('d-none');

    // Render podium victory screen
    renderPodiumVictoryScreen(response.attempt, response.remainingAttempts);

  } catch (error) {
    gameState.submittingLock = false;
    if (loadingOverlay) loadingOverlay.classList.add('d-none');

    showSyncErrorModal('Failed to submit final quiz results to the server: ' + (error.message || 'Network error'), () => {
      finalizeAndSubmitQuiz();
    });
  }
}

// --- Render Podium Screen ---
function renderPodiumVictoryScreen(attempt, remainingAttempts) {
  document.getElementById('kbc-game-stage').classList.add('d-none');
  const podiumView = document.getElementById('kbc-podium-view');
  podiumView.classList.remove('d-none');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Play victory chime
  if (window.soundFX) window.soundFX.playVictory();

  // Metrics
  document.getElementById('stat-score-percent').textContent = `${attempt.percentage}%`;
  document.getElementById('stat-correct-count').textContent = `${attempt.score} / ${attempt.totalQuestions}`;
  document.getElementById('stat-wrong-count').textContent = attempt.incorrectCount !== undefined ? attempt.incorrectCount : (attempt.totalQuestions - attempt.score);
  document.getElementById('stat-points-total').textContent = (gameState.totalPointsEarned || (attempt.score * 5000)).toLocaleString();

  // Titles & Messages based on performance
  const title = document.getElementById('podium-status-title');
  const desc = document.getElementById('podium-status-desc');
  const trophy = document.getElementById('podium-trophy-icon');
  const stamp = document.getElementById('podium-attempt-stamp');

  if (attempt.percentage === 100) {
    title.textContent = 'Flawless Victory! Grand Champion!';
    title.className = 'display-6 fw-bold text-warning mb-2';
    desc.textContent = `Magnificent! You conquered all 5 levels with a perfect 100% score!`;
    trophy.className = 'fa-solid fa-trophy kbc-trophy-icon text-warning';
    triggerConfettiParticles();
  } else if (attempt.passed) {
    title.textContent = 'Assessment Passed! Well Done!';
    title.className = 'display-6 fw-bold text-success mb-2';
    desc.textContent = `Great performance! You achieved ${attempt.score} correct answers out of ${attempt.totalQuestions}.`;
    trophy.className = 'fa-solid fa-medal kbc-trophy-icon text-success';
    triggerConfettiParticles();
  } else {
    title.textContent = 'Assessment Complete • Keep Practicing!';
    title.className = 'display-6 fw-bold text-light mb-2';
    desc.textContent = `You scored ${attempt.score} out of ${attempt.totalQuestions} questions. Review the detailed rationales below to master this domain.`;
    trophy.className = 'fa-solid fa-award kbc-trophy-icon text-secondary';
  }

  // Attempt Budget Badge & Retake Button
  const retakeBtn = document.getElementById('btn-podium-retake');
  if (attempt.attemptNumber === 1) {
    stamp.innerHTML = '<span class="badge bg-warning text-dark px-3 py-1.5 rounded-pill fw-bold"><i class="fa-solid fa-flag me-1"></i> Official Attempt #1 of 2 Complete</span>';
    if (retakeBtn) {
      retakeBtn.classList.remove('d-none');
      const retakeQuizParam = attempt.quizId ? `&quizId=${encodeURIComponent(attempt.quizId)}` : '';
      retakeBtn.href = `quiz-room.html?categoryId=${attempt.categoryId}${retakeQuizParam}`;
      retakeBtn.innerHTML = '<i class="fa-solid fa-rotate-right me-1"></i> Retake Quiz (Final Attempt 2/2)';
    }
  } else {
    stamp.innerHTML = '<span class="badge bg-danger px-3 py-1.5 rounded-pill fw-bold"><i class="fa-solid fa-lock me-1"></i> Final Attempt (#2 of 2) Complete</span>';
    if (retakeBtn) {
      retakeBtn.classList.add('d-none'); // 2-attempt limit reached!
    }
  }

  // Build Comprehensive Review Breakdown
  renderDetailedReviewCards(attempt.answers);
}

// Toggle Collapsible Review Section
function toggleDetailedReview() {
  const section = document.getElementById('kbc-detailed-review-section');
  if (!section) return;

  if (section.classList.contains('d-none')) {
    section.classList.remove('d-none');
    section.scrollIntoView({ behavior: 'smooth' });
  } else {
    section.classList.add('d-none');
  }
}

// Render Review Breakdown
function renderDetailedReviewCards(answers) {
  const container = document.getElementById('kbc-review-cards-container');
  if (!container) return;

  container.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  answers.forEach((ans, idx) => {
    const card = document.createElement('div');
    card.className = 'p-3 bg-dark bg-opacity-60 border border-secondary border-opacity-25 rounded-3 mb-3';

    // Status Badge
    let statusBadge = '';
    if (ans.isCorrect) {
      statusBadge = '<span class="badge bg-success text-white px-2.5 py-1 rounded-pill"><i class="fa-solid fa-check me-1"></i> Correct</span>';
    } else if (ans.isSkipped) {
      statusBadge = '<span class="badge bg-secondary text-white px-2.5 py-1 rounded-pill"><i class="fa-solid fa-forward me-1"></i> Skipped</span>';
    } else {
      statusBadge = '<span class="badge bg-danger text-white px-2.5 py-1 rounded-pill"><i class="fa-solid fa-xmark me-1"></i> Incorrect</span>';
    }

    // Options breakdown
    let optionsHtml = '';
    ans.options.forEach((optText, optIdx) => {
      let optBorder = 'border-secondary border-opacity-25 bg-dark';
      let optTextClass = 'text-light';
      let optIcon = '';

      const isUserChoice = ans.selectedOption === optIdx;
      const isActualCorrect = ans.correctOption === optIdx;

      if (isActualCorrect) {
        optBorder = 'border-success bg-success bg-opacity-10';
        optTextClass = 'text-success fw-bold';
        optIcon = '<span class="badge bg-success text-white ms-auto">Correct Answer</span>';
      } else if (isUserChoice && !ans.isCorrect) {
        optBorder = 'border-danger bg-danger bg-opacity-10';
        optTextClass = 'text-danger fw-semibold';
        optIcon = '<span class="badge bg-danger text-white ms-auto">Your Choice</span>';
      }

      optionsHtml += `
        <div class="p-2 border rounded d-flex align-items-center mb-1.5 ${optBorder}">
          <span class="fw-bold me-2 font-monospace ${optTextClass}">${letters[optIdx]}.</span>
          <span class="${optTextClass}">${optText}</span>
          ${optIcon}
        </div>
      `;
    });

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold text-warning small font-monospace">Level ${idx + 1} • Question ${idx + 1}</span>
        ${statusBadge}
      </div>
      <h6 class="fw-bold text-white mb-3">${ans.questionText}</h6>
      <div class="mb-3">${optionsHtml}</div>
      <div class="p-2.5 bg-dark border border-secondary border-opacity-25 rounded small">
        <div class="fw-bold text-warning text-uppercase mb-1" style="font-size: 0.75rem; letter-spacing: 0.05em;">
          <i class="fa-solid fa-lightbulb me-1"></i> Explanation & Conceptual Rationale:
        </div>
        <div class="text-light">${ans.explanation}</div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Past attempt review view
async function renderPastAttemptReview(attemptId) {
  try {
    document.getElementById('kbc-welcome-view').classList.add('d-none');
    document.getElementById('kbc-game-stage').classList.add('d-none');
    const podiumView = document.getElementById('kbc-podium-view');
    podiumView.classList.remove('d-none');

    const attempt = await API.getAttemptReview(attemptId);
    gameState.totalPointsEarned = attempt.score * 5000;
    renderPodiumVictoryScreen(attempt, 2 - attempt.attemptNumber);

  } catch (err) {
    alert('Unable to load attempt review: ' + err.message);
    window.location.href = 'user-dashboard.html';
  }
}

// --- Confetti Particles Effect ---
function triggerConfettiParticles() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.parentElement.offsetWidth;
  canvas.height = canvas.parentElement.offsetHeight;

  const particles = [];
  const colors = ['#F59E0B', '#10B981', '#06B6D4', '#F43F5E', '#FFFFFF'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 3 + 2,
      speedX: (Math.random() - 0.5) * 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 6
    });
  }

  let animationFrame;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (particles.some(p => p.y < canvas.height)) {
      animationFrame = requestAnimationFrame(render);
    }
  }

  render();
}

// Network Sync Modal Helper
let retrySyncCallback = null;
function showSyncErrorModal(msg, onRetry) {
  retrySyncCallback = onRetry;
  document.getElementById('kbc-error-msg').textContent = msg;
  const modalEl = document.getElementById('kbcErrorModal');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function retrySyncOperation() {
  const modalEl = document.getElementById('kbcErrorModal');
  const instance = bootstrap.Modal.getInstance(modalEl);
  if (instance) instance.hide();

  if (typeof retrySyncCallback === 'function') {
    retrySyncCallback();
  }
}

// Lightweight Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-success' : type === 'warning' ? 'bg-warning text-dark' : type === 'danger' ? 'bg-danger text-white' : 'bg-dark text-white border-warning';
  toast.className = `toast align-items-center ${bgClass} border-0 show mb-2`;
  toast.role = 'alert';
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body small fw-semibold">
        <i class="fa-solid fa-circle-info me-1"></i> ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}
