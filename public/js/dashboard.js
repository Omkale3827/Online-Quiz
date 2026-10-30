// public/js/dashboard.js - User Topic Dashboard & Attempt Restriction Engine

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce logged-in user guard
  if (!Auth.guard()) return;

  const user = API.getUser();
  const welcomeNameEl = document.getElementById('user-welcome-name');
  if (welcomeNameEl) welcomeNameEl.textContent = user.name;

  await loadDashboardCategories();
  await loadUserAttemptHistory();
});

async function loadDashboardCategories() {
  const container = document.getElementById('categories-grid');
  if (!container) return;

  try {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="text-muted mt-2">Loading available quiz domains...</div>
      </div>
    `;

    const categories = await API.getCategories();
    if (categories.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <p class="text-muted">No quiz domains currently active. Check back shortly!</p>
        </div>
      `;
      return;
    }

    // Fetch attempt status for each category in parallel
    const statusPromises = categories.map(cat => API.getQuizStatus(cat.id));
    const statuses = await Promise.all(statusPromises);

    container.innerHTML = '';

    categories.forEach((cat, index) => {
      const status = statuses[index] || { attemptCount: 0, maxAttempts: 2, isMaxReached: false, userAttempts: [] };
      const attemptsCount = status.attemptCount;
      const isMaxReached = attemptsCount >= 2;
      const totalQuestions = cat.questionCount || 0;

      // Card Element
      const col = document.createElement('div');
      col.className = 'col-lg-4 col-md-6 mb-4';

      // Badge class based on attempts
      let attemptBadgeHtml = '';
      if (attemptsCount === 0) {
        attemptBadgeHtml = `<span class="attempt-badge attempt-badge-0"><i class="fa-regular fa-circle"></i> Attempts: 0/2</span>`;
      } else if (attemptsCount === 1) {
        attemptBadgeHtml = `<span class="attempt-badge attempt-badge-1"><i class="fa-solid fa-circle-half-stroke"></i> Attempts: 1/2</span>`;
      } else {
        attemptBadgeHtml = `<span class="attempt-badge attempt-badge-2"><i class="fa-solid fa-circle-check"></i> Max Attempts Reached (2/2)</span>`;
      }

      // Difficulty badge
      const difficultyBadge = `<span class="badge-pill ${cat.badgeClass || 'badge-medium'}">${cat.difficulty || 'Medium'}</span>`;

      // Action button based on attempt restriction
      let actionButtonsHtml = '';
      if (totalQuestions === 0) {
        actionButtonsHtml = `
          <button class="btn btn-omnix-outline w-100" disabled>
            <i class="fa-solid fa-clock-rotate-left me-1"></i> Coming Soon
          </button>
        `;
      } else if (isMaxReached) {
        // Disabled Start Quiz + View Last Result
        const lastAttempt = status.userAttempts && status.userAttempts.length > 0 
          ? status.userAttempts[status.userAttempts.length - 1] 
          : null;

        actionButtonsHtml = `
          <button class="btn btn-omnix-primary w-100 mb-2" disabled title="Maximum attempts limit reached">
            <i class="fa-solid fa-lock me-1"></i> Max Attempts Reached (2/2)
          </button>
          ${lastAttempt ? `
            <a href="quiz-room.html?categoryId=${cat.id}&reviewAttemptId=${lastAttempt.id}" class="btn btn-omnix-outline w-100 btn-sm">
              <i class="fa-solid fa-square-poll-vertical me-1"></i> View Last Result (${lastAttempt.percentage}%)
            </a>
          ` : ''}
        `;
      } else if (attemptsCount === 1) {
        // 1 attempt left
        const firstAttempt = status.userAttempts && status.userAttempts[0];
        actionButtonsHtml = `
          <a href="quiz-room.html?categoryId=${cat.id}" class="btn btn-omnix-primary w-100 mb-2">
            <i class="fa-solid fa-play me-1"></i> Retake Quiz (Attempt 2 of 2)
          </a>
          ${firstAttempt ? `
            <a href="quiz-room.html?categoryId=${cat.id}&reviewAttemptId=${firstAttempt.id}" class="btn btn-omnix-outline w-100 btn-sm">
              <i class="fa-solid fa-clock-rotate-left me-1"></i> Review Attempt #1 (${firstAttempt.percentage}%)
            </a>
          ` : ''}
        `;
      } else {
        // 0 attempts made
        actionButtonsHtml = `
          <a href="quiz-room.html?categoryId=${cat.id}" class="btn btn-omnix-primary w-100">
            <i class="fa-solid fa-play me-1"></i> Start Quiz
          </a>
        `;
      }

      // If multiple quizzes exist under this domain, render independent quiz buttons
      if (status.quizzes && status.quizzes.length > 1) {
        let multiQuizListHtml = '';
        status.quizzes.forEach(qz => {
          const qzAttempts = qz.attemptCount || 0;
          const qzMaxReached = qzAttempts >= 2;
          let qzBadge = '';
          if (qzAttempts === 0) {
            qzBadge = `<span class="badge bg-light text-muted border"><i class="fa-regular fa-circle me-1"></i>0/2</span>`;
          } else if (qzAttempts === 1) {
            qzBadge = `<span class="badge bg-warning-subtle text-warning border border-warning-subtle"><i class="fa-solid fa-circle-half-stroke me-1"></i>1/2</span>`;
          } else {
            qzBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="fa-solid fa-circle-check me-1"></i>2/2 Max</span>`;
          }

          let qzButton = '';
          const lastAtt = qz.userAttempts && qz.userAttempts.length > 0 ? qz.userAttempts[qz.userAttempts.length - 1] : null;

          if (qzMaxReached) {
            qzButton = `
              <div class="d-flex gap-1 w-100">
                <button class="btn btn-sm btn-secondary w-50 py-1" disabled><i class="fa-solid fa-lock me-1"></i>Locked</button>
                ${lastAtt ? `<a href="quiz-room.html?categoryId=${cat.id}&quizId=${qz.id}&reviewAttemptId=${lastAtt.id}" class="btn btn-sm btn-omnix-outline w-50 py-1">Review (${lastAtt.percentage}%)</a>` : ''}
              </div>
            `;
          } else if (qzAttempts === 1) {
            qzButton = `
              <div class="d-flex gap-1 w-100">
                <a href="quiz-room.html?categoryId=${cat.id}&quizId=${qz.id}" class="btn btn-sm btn-omnix-primary w-50 py-1"><i class="fa-solid fa-rotate-right me-1"></i>Retake</a>
                ${lastAtt ? `<a href="quiz-room.html?categoryId=${cat.id}&quizId=${qz.id}&reviewAttemptId=${lastAtt.id}" class="btn btn-sm btn-omnix-outline w-50 py-1">Review</a>` : ''}
              </div>
            `;
          } else {
            qzButton = `
              <a href="quiz-room.html?categoryId=${cat.id}&quizId=${qz.id}" class="btn btn-sm btn-omnix-primary w-100 py-1">
                <i class="fa-solid fa-play me-1"></i> Start ${qz.title} (5 Qs)
              </a>
            `;
          }

          multiQuizListHtml += `
            <div class="p-2.5 bg-light rounded-2 border mb-2">
              <div class="d-flex justify-content-between align-items-center mb-1.5">
                <strong class="text-heading small"><i class="fa-solid fa-file-lines text-primary me-1"></i>${qz.title}</strong>
                ${qzBadge}
              </div>
              ${qzButton}
            </div>
          `;
        });

        col.innerHTML = `
          <div class="category-card">
            <div class="category-card-header">
              <div class="category-icon-wrapper">
                <i class="fa-solid ${cat.icon || 'fa-folder'}"></i>
              </div>
              <div class="d-flex gap-1">
                <span class="badge bg-primary text-white rounded-pill px-2.5 py-1">${status.quizzes.length} Quizzes</span>
                ${difficultyBadge}
              </div>
            </div>
            <div class="category-card-body">
              <h5 class="mb-1 fw-bold">${cat.name}</h5>
              <p class="text-muted small mb-3">${cat.description || 'Test your knowledge and sharpen your skills.'}</p>
              <div class="small fw-bold text-muted mb-2"><i class="fa-solid fa-list-ol me-1"></i> Select Quiz track (5 Qs each):</div>
              <div class="multi-quiz-list">
                ${multiQuizListHtml}
              </div>
            </div>
            <div class="category-card-footer">
              <div class="text-muted small text-center">
                <i class="fa-solid fa-shield-halved text-warning me-1"></i> Strict 2-attempt quota enforced per quiz
              </div>
            </div>
          </div>
        `;

        container.appendChild(col);
        return;
      }

      col.innerHTML = `
        <div class="category-card">
          <div class="category-card-header">
            <div class="category-icon-wrapper">
              <i class="fa-solid ${cat.icon || 'fa-folder'}"></i>
            </div>
            ${difficultyBadge}
          </div>
          <div class="category-card-body">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h5 class="mb-0 fw-bold">${cat.name}</h5>
            </div>
            <p class="text-muted small mb-3">${cat.description || 'Test your knowledge and sharpen your skills.'}</p>
            <div class="d-flex align-items-center justify-content-between text-muted small pt-2 border-top">
              <span><i class="fa-regular fa-circle-question me-1"></i> ${totalQuestions} Questions</span>
              <span><i class="fa-regular fa-clock me-1"></i> ${cat.totalTimeMinutes || 5} Mins</span>
            </div>
          </div>
          <div class="category-card-footer">
            <div class="mb-2.5 d-flex justify-content-between align-items-center">
              <span class="small fw-semibold text-muted">Eligibility:</span>
              ${attemptBadgeHtml}
            </div>
            ${actionButtonsHtml}
          </div>
        </div>
      `;

      container.appendChild(col);
    });

  } catch (error) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-danger">
        <i class="fa-solid fa-triangle-exclamation fs-3 mb-2"></i>
        <p>Failed to load quiz categories: ${error.message}</p>
        <button class="btn btn-omnix-outline btn-sm" onclick="loadDashboardCategories()">Try Again</button>
      </div>
    `;
  }
}

async function loadUserAttemptHistory() {
  const historyContainer = document.getElementById('user-recent-attempts');
  if (!historyContainer) return;

  const user = API.getUser();
  if (!user) return;

  try {
    const res = await API.getAdminAttempts(); // Gets attempts
    // Filter attempts for this user
    const myAttempts = (res.allAttempts || []).filter(a => a.userId === user.id);

    if (myAttempts.length === 0) {
      historyContainer.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="fa-regular fa-clipboard fs-2 mb-2 opacity-50"></i>
          <p class="mb-0">You have not taken any quizzes yet. Choose a domain above to get started!</p>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    myAttempts.forEach(att => {
      const dateFormatted = new Date(att.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const passBadge = att.passed
        ? `<span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill">Passed</span>`
        : `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1 rounded-pill">Needs Review</span>`;

      rowsHtml += `
        <tr>
          <td>
            <div class="fw-bold text-heading">${att.categoryName}${att.quizTitle ? ' — ' + att.quizTitle : ''}</div>
            <span class="small text-muted">Attempt #${att.attemptNumber} of 2</span>
          </td>
          <td>
            <div class="fw-bold ${att.passed ? 'text-success' : 'text-danger'}">${att.score} / ${att.totalQuestions}</div>
            <div class="small text-muted">${att.percentage}% score</div>
          </td>
          <td>${passBadge}</td>
          <td class="text-muted small">${dateFormatted}</td>
          <td class="text-end">
            <a href="quiz-room.html?categoryId=${att.categoryId}&reviewAttemptId=${att.id}" class="btn btn-omnix-outline btn-sm">
              <i class="fa-solid fa-eye me-1"></i> Review
            </a>
          </td>
        </tr>
      `;
    });

    historyContainer.innerHTML = `
      <div class="table-responsive">
        <table class="table table-omnix mb-0">
          <thead>
            <tr>
              <th>Quiz Domain</th>
              <th>Score</th>
              <th>Status</th>
              <th>Date & Time</th>
              <th class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    console.error('Error loading attempt history:', err);
  }
}
