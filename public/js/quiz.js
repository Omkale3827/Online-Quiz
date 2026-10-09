// public/js/quiz.js - Distraction-Free Quiz Room & Comprehensive Review Engine

let currentQuizState = {
  categoryId: null,
  category: null,
  questions: [],
  currentIndex: 0,
  userAnswers: {}, // questionId -> selectedOptionIndex (0, 1, 2, 3)
  markedForReview: new Set(),
  timerInterval: null,
  remainingSeconds: 0,
  totalSeconds: 0,
  isSubmitted: false
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.guard()) return;

  const urlParams = new URLSearchParams(window.location.search);
  const categoryId = urlParams.get('categoryId');
  const reviewAttemptId = urlParams.get('reviewAttemptId');

  if (!categoryId && !reviewAttemptId) {
    showToast('No quiz selected', 'warning');
    setTimeout(() => { window.location.href = 'user-dashboard.html'; }, 1000);
    return;
  }

  // If in pure review mode for a past attempt
  if (reviewAttemptId) {
    await renderPastAttemptReview(reviewAttemptId);
    return;
  }

  // Active quiz mode: verify attempts and initialize
  currentQuizState.categoryId = categoryId;
  await initQuizRoom(categoryId);
});

async function initQuizRoom(categoryId) {
  try {
    // 1. Check attempt restriction
    const status = await API.getQuizStatus(categoryId);
    if (status.isMaxReached) {
      alert('Maximum attempts reached (2/2) for this quiz. You cannot take this quiz again.');
      window.location.href = 'user-dashboard.html';
      return;
    }

    // 2. Fetch quiz questions
    const quizData = await API.getQuizQuestions(categoryId);
    currentQuizState.category = quizData.category;
    currentQuizState.questions = quizData.questions;
    currentQuizState.currentIndex = 0;
    currentQuizState.userAnswers = {};
    currentQuizState.markedForReview.clear();

    // 3. Setup Timer
    const durationMinutes = quizData.category.totalTimeMinutes || 5;
    currentQuizState.totalSeconds = durationMinutes * 60;
    currentQuizState.remainingSeconds = currentQuizState.totalSeconds;

    // 4. Update Header UI
    document.getElementById('quiz-title').textContent = quizData.category.name;
    document.getElementById('quiz-subtitle').textContent = `${quizData.category.difficulty || 'Standard'} Assessment • ${quizData.questions.length} Questions`;

    // 5. Build question navigation palette
    buildQuestionPalette();

    // 6. Start Timer
    startTimer();

    // 7. Render first question
    renderCurrentQuestion();

    // 8. Attach keyboard shortcuts
    attachKeyboardShortcuts();

  } catch (error) {
    console.error('Quiz init error:', error);
    alert(error.message || 'Unable to load quiz');
    window.location.href = 'user-dashboard.html';
  }
}

function startTimer() {
  const timerEl = document.getElementById('quiz-timer');
  const timerBox = document.getElementById('timer-box');

  updateTimerDisplay();

  currentQuizState.timerInterval = setInterval(() => {
    if (currentQuizState.remainingSeconds <= 0) {
      clearInterval(currentQuizState.timerInterval);
      showToast('Time is up! Submitting your answers automatically.', 'warning');
      submitQuiz(true); // force auto-submit
      return;
    }

    currentQuizState.remainingSeconds--;
    updateTimerDisplay();

    // Color transition based on remaining time
    const ratio = currentQuizState.remainingSeconds / currentQuizState.totalSeconds;
    if (timerBox) {
      timerBox.className = 'timer-box';
      if (ratio <= 0.2 || currentQuizState.remainingSeconds <= 60) {
        timerBox.classList.add('timer-danger');
      } else if (ratio <= 0.4) {
        timerBox.classList.add('timer-warning');
      } else {
        timerBox.classList.add('timer-safe');
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('quiz-timer');
  if (!timerEl) return;
  const minutes = Math.floor(currentQuizState.remainingSeconds / 60);
  const seconds = currentQuizState.remainingSeconds % 60;
  timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildQuestionPalette() {
  const paletteContainer = document.getElementById('question-palette');
  if (!paletteContainer) return;

  paletteContainer.innerHTML = '';
  currentQuizState.questions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary palette-btn';
    btn.id = `palette-btn-${idx}`;
    btn.textContent = idx + 1;
    btn.onclick = () => jumpToQuestion(idx);
    paletteContainer.appendChild(btn);
  });
  updatePaletteState();
}

function updatePaletteState() {
  currentQuizState.questions.forEach((q, idx) => {
    const btn = document.getElementById(`palette-btn-${idx}`);
    if (!btn) return;

    btn.className = 'btn btn-sm palette-btn';
    const isCurrent = idx === currentQuizState.currentIndex;
    const isAnswered = currentQuizState.userAnswers[q.id] !== undefined;
    const isMarked = currentQuizState.markedForReview.has(q.id);

    if (isCurrent) {
      btn.classList.add('btn-primary', 'shadow-sm', 'fw-bold');
    } else if (isMarked) {
      btn.classList.add('btn-warning', 'text-dark', 'fw-semibold');
    } else if (isAnswered) {
      btn.classList.add('btn-success', 'text-white');
    } else {
      btn.classList.add('btn-outline-secondary');
    }
  });
}

function renderCurrentQuestion() {
  const q = currentQuizState.questions[currentQuizState.currentIndex];
  if (!q) return;

  const total = currentQuizState.questions.length;
  const curNum = currentQuizState.currentIndex + 1;

  // Counter & Progress
  document.getElementById('question-counter').textContent = `Question ${curNum} of ${total}`;
  const progressPercent = Math.round((curNum / total) * 100);
  document.getElementById('quiz-progress-bar').style.width = `${progressPercent}%`;

  // Question Text
  document.getElementById('question-text').textContent = q.questionText;

  // Mark for review button state
  const markBtn = document.getElementById('btn-mark-review');
  if (markBtn) {
    if (currentQuizState.markedForReview.has(q.id)) {
      markBtn.className = 'btn btn-warning btn-sm text-dark';
      markBtn.innerHTML = '<i class="fa-solid fa-flag me-1"></i> Marked for Review';
    } else {
      markBtn.className = 'btn btn-omnix-outline btn-sm';
      markBtn.innerHTML = '<i class="fa-regular fa-flag me-1"></i> Mark for Review';
    }
  }

  // Options
  const letters = ['A', 'B', 'C', 'D'];
  const optionsGrid = document.getElementById('options-grid');
  optionsGrid.innerHTML = '';

  const currentSelection = currentQuizState.userAnswers[q.id];

  q.options.forEach((optText, optIdx) => {
    const isSelected = currentSelection === optIdx;
    const optDiv = document.createElement('div');
    optDiv.className = `option-item ${isSelected ? 'selected' : ''}`;
    optDiv.onclick = () => selectOption(optIdx);

    optDiv.innerHTML = `
      <div class="option-letter">${letters[optIdx]}</div>
      <div class="option-label">${optText}</div>
      <div class="ms-auto text-primary ${isSelected ? 'd-block' : 'd-none'}">
        <i class="fa-solid fa-circle-check fs-5"></i>
      </div>
    `;

    optionsGrid.appendChild(optDiv);
  });

  // Nav buttons
  const prevBtn = document.getElementById('btn-prev-question');
  const nextBtn = document.getElementById('btn-next-question');

  if (prevBtn) prevBtn.disabled = currentQuizState.currentIndex === 0;
  if (nextBtn) {
    if (currentQuizState.currentIndex === total - 1) {
      nextBtn.innerHTML = 'Review & Submit <i class="fa-solid fa-arrow-right ms-1"></i>';
      nextBtn.onclick = () => openSubmitModal();
    } else {
      nextBtn.innerHTML = 'Next Question <i class="fa-solid fa-arrow-right ms-1"></i>';
      nextBtn.onclick = () => nextQuestion();
    }
  }

  updatePaletteState();
}

function selectOption(optIndex) {
  const q = currentQuizState.questions[currentQuizState.currentIndex];
  if (!q) return;

  currentQuizState.userAnswers[q.id] = optIndex;
  renderCurrentQuestion();
}

function prevQuestion() {
  if (currentQuizState.currentIndex > 0) {
    currentQuizState.currentIndex--;
    renderCurrentQuestion();
  }
}

function nextQuestion() {
  if (currentQuizState.currentIndex < currentQuizState.questions.length - 1) {
    currentQuizState.currentIndex++;
    renderCurrentQuestion();
  } else {
    openSubmitModal();
  }
}

function jumpToQuestion(idx) {
  if (idx >= 0 && idx < currentQuizState.questions.length) {
    currentQuizState.currentIndex = idx;
    renderCurrentQuestion();
  }
}

function toggleMarkForReview() {
  const q = currentQuizState.questions[currentQuizState.currentIndex];
  if (!q) return;

  if (currentQuizState.markedForReview.has(q.id)) {
    currentQuizState.markedForReview.delete(q.id);
  } else {
    currentQuizState.markedForReview.add(q.id);
  }
  renderCurrentQuestion();
}

function attachKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Only capture if not focused in an input/textarea and quiz active
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (currentQuizState.isSubmitted) return;

    if (e.key === '1' || e.key.toUpperCase() === 'A') selectOption(0);
    if (e.key === '2' || e.key.toUpperCase() === 'B') selectOption(1);
    if (e.key === '3' || e.key.toUpperCase() === 'C') selectOption(2);
    if (e.key === '4' || e.key.toUpperCase() === 'D') selectOption(3);
    if (e.key === 'ArrowRight') nextQuestion();
    if (e.key === 'ArrowLeft') prevQuestion();
  });
}

function openSubmitModal() {
  const total = currentQuizState.questions.length;
  const answeredCount = Object.keys(currentQuizState.userAnswers).length;
  const unansweredCount = total - answeredCount;
  const markedCount = currentQuizState.markedForReview.size;

  document.getElementById('modal-answered-count').textContent = answeredCount;
  document.getElementById('modal-unanswered-count').textContent = unansweredCount;
  document.getElementById('modal-marked-count').textContent = markedCount;

  const submitModal = new bootstrap.Modal(document.getElementById('submitConfirmModal'));
  submitModal.show();
}

async function submitQuiz(autoSubmit = false) {
  if (currentQuizState.isSubmitted) return;
  currentQuizState.isSubmitted = true;

  if (currentQuizState.timerInterval) {
    clearInterval(currentQuizState.timerInterval);
  }

  // Hide modal if open
  const modalEl = document.getElementById('submitConfirmModal');
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();

  // Show loading overlay
  const loadingOverlay = document.getElementById('quiz-submitting-overlay');
  if (loadingOverlay) loadingOverlay.classList.remove('d-none');

  try {
    // Format answers array
    const formattedAnswers = Object.entries(currentQuizState.userAnswers).map(([qId, optIdx]) => ({
      questionId: qId,
      selectedOption: optIdx
    }));

    const response = await API.submitQuiz(currentQuizState.categoryId, formattedAnswers);
    if (loadingOverlay) loadingOverlay.classList.add('d-none');

    // Render results
    renderQuizResultScreen(response.attempt, response.remainingAttempts);

  } catch (error) {
    if (loadingOverlay) loadingOverlay.classList.add('d-none');
    alert(error.message || 'Failed to submit quiz attempt.');
    window.location.href = 'user-dashboard.html';
  }
}

function renderQuizResultScreen(attempt, remainingAttempts) {
  const activeQuizCard = document.getElementById('active-quiz-view');
  const resultReviewView = document.getElementById('result-review-view');

  if (activeQuizCard) activeQuizCard.classList.add('d-none');
  if (resultReviewView) resultReviewView.classList.remove('d-none');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Score Header
  const scoreCircle = document.getElementById('result-score-circle');
  const scoreNum = document.getElementById('result-score-number');
  const resultTitle = document.getElementById('result-status-title');
  const resultMessage = document.getElementById('result-status-message');
  const attemptStamp = document.getElementById('result-attempt-stamp');

  scoreNum.textContent = `${attempt.percentage}%`;

  if (attempt.passed) {
    scoreCircle.className = 'score-circle pass';
    resultTitle.textContent = 'Assessment Passed!';
    resultTitle.className = 'fw-bold text-success mb-2';
    resultMessage.textContent = `Great work! You scored ${attempt.score} out of ${attempt.totalQuestions} questions correctly.`;
  } else {
    scoreCircle.className = 'score-circle fail';
    resultTitle.textContent = 'Assessment Not Passed';
    resultTitle.className = 'fw-bold text-danger mb-2';
    resultMessage.textContent = `You scored ${attempt.score} out of ${attempt.totalQuestions}. Passing score is 60%. Review your mistakes below.`;
  }

  // Attempt Banner & Retake Button
  const retakeBtn = document.getElementById('btn-retake-quiz');
  if (attempt.attemptNumber === 1) {
    attemptStamp.innerHTML = `<span class="badge bg-primary px-3 py-1.5 rounded-pill"><i class="fa-solid fa-flag"></i> Attempt #1 of 2 Complete</span>`;
    if (retakeBtn) {
      retakeBtn.classList.remove('d-none');
      retakeBtn.href = `quiz-room.html?categoryId=${attempt.categoryId}`;
      retakeBtn.innerHTML = '<i class="fa-solid fa-rotate-right me-1"></i> Retake Quiz (Final Attempt 2/2)';
    }
  } else {
    attemptStamp.innerHTML = `<span class="badge bg-danger px-3 py-1.5 rounded-pill"><i class="fa-solid fa-lock"></i> Final Attempt (#2 of 2) Complete</span>`;
    if (retakeBtn) {
      retakeBtn.classList.add('d-none'); // 2-attempt limit reached!
    }
  }

  // Build Comprehensive Review Breakdown
  renderReviewList(attempt.answers);
}

function renderReviewList(answers) {
  const container = document.getElementById('review-questions-list');
  if (!container) return;

  container.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  answers.forEach((ans, idx) => {
    const card = document.createElement('div');
    card.className = 'review-card';

    // Status icon badge
    const statusBadge = ans.isCorrect
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1.5"><i class="fa-solid fa-circle-check me-1"></i> Correct</span>`
      : `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-3 py-1.5"><i class="fa-solid fa-circle-xmark me-1"></i> Incorrect</span>`;

    // Options breakdown
    let optionsHtml = '';
    ans.options.forEach((optText, optIdx) => {
      let optionClass = 'review-option neutral';
      let icon = '';

      const isUserChoice = ans.selectedOption === optIdx;
      const isActualCorrect = ans.correctOption === optIdx;

      if (isActualCorrect) {
        optionClass = 'review-option correct';
        icon = '<span class="badge bg-success text-white rounded-pill ms-2"><i class="fa-solid fa-check me-1"></i> Correct Answer</span>';
      } else if (isUserChoice && !ans.isCorrect) {
        optionClass = 'review-option wrong';
        icon = '<span class="badge bg-danger text-white rounded-pill ms-2"><i class="fa-solid fa-xmark me-1"></i> Your Choice</span>';
      }

      optionsHtml += `
        <div class="${optionClass}">
          <div class="d-flex align-items-center">
            <span class="fw-bold me-2">${letters[optIdx]}.</span>
            <span>${optText}</span>
          </div>
          <div>${icon}</div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="fw-bold text-muted small">Question ${idx + 1}</span>
        ${statusBadge}
      </div>
      <h6 class="fw-bold text-heading mb-3">${ans.questionText}</h6>
      <div class="mb-3">${optionsHtml}</div>
      <div class="review-explanation">
        <div class="fw-bold text-primary small text-uppercase mb-1" style="letter-spacing: 0.05em;">
          <i class="fa-solid fa-lightbulb me-1"></i> Rationale & Explanation
        </div>
        <div>${ans.explanation}</div>
      </div>
    `;

    container.appendChild(card);
  });
}

async function renderPastAttemptReview(attemptId) {
  try {
    const activeQuizCard = document.getElementById('active-quiz-view');
    const resultReviewView = document.getElementById('result-review-view');
    if (activeQuizCard) activeQuizCard.classList.add('d-none');
    if (resultReviewView) resultReviewView.classList.remove('d-none');

    const attempt = await API.getAttemptReview(attemptId);
    renderQuizResultScreen(attempt, 2 - attempt.attemptNumber);

    // Also update subtitle
    const backBtn = document.getElementById('btn-back-dashboard');
    if (backBtn) backBtn.href = 'user-dashboard.html';

  } catch (err) {
    alert('Unable to load attempt review: ' + err.message);
    window.location.href = 'user-dashboard.html';
  }
}
