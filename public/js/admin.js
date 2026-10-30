// public/js/admin.js - Admin Analytics Dashboard & User Submission Tracker

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce ADMIN role check
  if (!Auth.guard('ROLE_ADMIN')) return;

  await loadAdminMetrics();
  await loadRegisteredUsersTable();
  await loadDetailedSubmissionLogs();

  setupAdminEventHandlers();
});

async function loadAdminMetrics() {
  try {
    const data = await API.getAdminAnalytics();
    const metrics = data.metrics;

    // Metrics counters
    document.getElementById('stat-total-categories').textContent = metrics.totalCategories;
    document.getElementById('stat-total-questions').textContent = metrics.totalQuestions;
    document.getElementById('stat-registered-users').textContent = metrics.registeredUsers;
    document.getElementById('stat-total-attempts').textContent = metrics.totalAttempts;
    document.getElementById('stat-avg-score').textContent = `${metrics.averageScore}%`;

    // Category Performance Table
    const catTableBody = document.getElementById('admin-category-stats-body');
    if (catTableBody) {
      catTableBody.innerHTML = '';
      data.categoryStats.forEach(cat => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <div class="fw-bold">${cat.name}</div>
            <span class="badge-pill badge-${cat.difficulty.toLowerCase()}">${cat.difficulty}</span>
          </td>
          <td>${cat.questionsCount} questions</td>
          <td><span class="badge bg-light text-dark border px-2 py-1">${cat.attemptsCount} attempts</span></td>
          <td>
            <div class="d-flex align-items-center gap-2">
              <div class="progress flex-grow-1" style="height: 6px;">
                <div class="progress-bar bg-primary" style="width: ${cat.averageScore}%;"></div>
              </div>
              <span class="fw-bold small">${cat.averageScore}%</span>
            </div>
          </td>
        `;
        catTableBody.appendChild(row);
      });
    }

  } catch (error) {
    console.error('Error loading metrics:', error);
    showToast('Failed to load metrics: ' + error.message, 'danger');
  }
}

async function loadRegisteredUsersTable() {
  const tableBody = document.getElementById('admin-users-table-body');
  if (!tableBody) return;

  try {
    const users = await API.getAdminUsers();
    tableBody.innerHTML = '';

    users.forEach(u => {
      const isRootAdmin = u.role === 'ROLE_ADMIN';
      const roleBadge = isRootAdmin
        ? `<span class="badge bg-dark text-white rounded-pill px-2.5 py-1">ADMINISTRATOR</span>`
        : `<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2.5 py-1">STUDENT</span>`;

      const joinDate = new Date(u.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-2.5">
            <div class="rounded-circle bg-light border d-flex align-items-center justify-content-center text-primary fw-bold" style="width: 38px; height: 38px;">
              ${u.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="fw-bold text-heading">${u.name}</div>
              <div class="small text-muted">${u.email}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td>
          <span class="fw-bold">${u.totalAttempts}</span>
          <span class="text-muted small"> across ${u.completedQuizzes} topics</span>
        </td>
        <td>
          <span class="fw-bold ${u.averageScore >= 60 ? 'text-success' : 'text-danger'}">${u.averageScore}%</span>
        </td>
        <td class="text-muted small">${joinDate}</td>
      `;
      tableBody.appendChild(row);
    });

  } catch (err) {
    console.error('Error loading users:', err);
  }
}

let rawSubmissionLogs = [];
let allCandidateAverages = {};

async function loadDetailedSubmissionLogs() {
  const tableBody = document.getElementById('admin-attempts-table-body');
  if (!tableBody) return;

  try {
    const data = await API.getAdminAttempts();
    rawSubmissionLogs = data.userQuizLogs || [];
    allCandidateAverages = data.candidateOverallAverages || {};

    renderSubmissionTrackerTable();

  } catch (err) {
    console.error('Error loading submissions:', err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-danger">
          <i class="fa-solid fa-triangle-exclamation me-1"></i> Failed to load candidate submissions.
        </td>
      </tr>
    `;
  }
}

function handleTrackerFilterChange() {
  renderSubmissionTrackerTable();
}

function resetTrackerFilters() {
  const subjectSelect = document.getElementById('tracker-subject-filter');
  const sortSelect = document.getElementById('tracker-sort-by');
  const searchInput = document.getElementById('tracker-search-input');

  if (subjectSelect) subjectSelect.value = 'all';
  if (sortSelect) sortSelect.value = 'default';
  if (searchInput) searchInput.value = '';

  renderSubmissionTrackerTable();
}

function renderSubmissionTrackerTable() {
  const tableBody = document.getElementById('admin-attempts-table-body');
  if (!tableBody) return;

  const subjectFilter = (document.getElementById('tracker-subject-filter')?.value || 'all');
  const sortBy = (document.getElementById('tracker-sort-by')?.value || 'default');
  const searchQuery = (document.getElementById('tracker-search-input')?.value || '').trim().toLowerCase();

  // 1. Filter by Search Query
  let list = [...rawSubmissionLogs];
  if (searchQuery) {
    list = list.filter(log =>
      (log.userName && log.userName.toLowerCase().includes(searchQuery)) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(searchQuery)) ||
      (log.categoryName && log.categoryName.toLowerCase().includes(searchQuery))
    );
  }

  // 2. Filter by Subject
  if (subjectFilter !== 'all') {
    list = list.filter(log => log.categoryName === subjectFilter || log.categoryId === subjectFilter);
  }

  // 3. Sort Candidates
  if (sortBy === 'highest_marks') {
    list.sort((a, b) => {
      const scoreA = a.latestAttempt ? a.latestAttempt.score : -1;
      const scoreB = b.latestAttempt ? b.latestAttempt.score : -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const pctA = a.latestAttempt ? a.latestAttempt.percentage : -1;
      const pctB = b.latestAttempt ? b.latestAttempt.percentage : -1;
      if (pctB !== pctA) return pctB - pctA;
      return (a.userName || '').localeCompare(b.userName || '');
    });
  } else if (sortBy === 'lowest_marks') {
    list.sort((a, b) => {
      const scoreA = a.latestAttempt ? a.latestAttempt.score : 999;
      const scoreB = b.latestAttempt ? b.latestAttempt.score : 999;
      if (scoreA !== scoreB) return scoreA - scoreB;
      const pctA = a.latestAttempt ? a.latestAttempt.percentage : 999;
      const pctB = b.latestAttempt ? b.latestAttempt.percentage : 999;
      if (pctA !== pctB) return pctA - pctB;
      return (a.userName || '').localeCompare(b.userName || '');
    });
  } else if (sortBy === 'highest_average') {
    list.sort((a, b) => {
      const avgA = a.candidateAverage ? a.candidateAverage.averageMarks : 0;
      const avgB = b.candidateAverage ? b.candidateAverage.averageMarks : 0;
      if (avgB !== avgA) return avgB - avgA;
      const pctA = a.candidateAverage ? a.candidateAverage.averagePercentage : 0;
      const pctB = b.candidateAverage ? b.candidateAverage.averagePercentage : 0;
      if (pctB !== pctA) return pctB - pctA;
      const scoreA = a.latestAttempt ? a.latestAttempt.score : 0;
      const scoreB = b.latestAttempt ? b.latestAttempt.score : 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.userName || '').localeCompare(b.userName || '');
    });
  } else {
    // Default Order: latest attempt timestamp descending
    list.sort((a, b) => {
      const timeA = a.latestAttempt ? new Date(a.latestAttempt.timestamp).getTime() : 0;
      const timeB = b.latestAttempt ? new Date(b.latestAttempt.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }

  // Update Status and Metrics Indicators
  const activeSubjectEl = document.getElementById('lbl-active-subject');
  const activeSortEl = document.getElementById('lbl-active-sort');
  const filteredCountEl = document.getElementById('lbl-filtered-count');
  const totalCountEl = document.getElementById('lbl-total-count');

  if (activeSubjectEl) activeSubjectEl.textContent = subjectFilter === 'all' ? 'All Subjects' : subjectFilter;
  if (activeSortEl) {
    activeSortEl.textContent = sortBy === 'highest_marks' ? 'Highest Marks'
      : sortBy === 'lowest_marks' ? 'Lowest Marks'
      : sortBy === 'highest_average' ? 'Highest Average'
      : 'Default Order';
  }
  if (filteredCountEl) filteredCountEl.textContent = list.length;
  if (totalCountEl) totalCountEl.textContent = rawSubmissionLogs.length;

  tableBody.innerHTML = '';

  if (list.length === 0) {
    const filterMsg = subjectFilter !== 'all' ? ` for "${subjectFilter}"` : '';
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <i class="fa-solid fa-folder-open fs-3 d-block mb-2 text-secondary"></i>
          <div>No candidate submissions found${filterMsg}.</div>
          <button class="btn btn-sm btn-omnix-outline mt-2" onclick="resetTrackerFilters()">
            <i class="fa-solid fa-rotate-left me-1"></i> Reset Filters
          </button>
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(log => {
    const latest = log.latestAttempt;
    const prev = log.previousAttempt;

    // Latest Attempt Details (Marks)
    let latestHtml = `<span class="text-muted">—</span>`;
    if (latest) {
      const latestDate = new Date(latest.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      latestHtml = `
        <div>
          <span class="fw-bold ${latest.passed ? 'text-success' : 'text-danger'} font-monospace">
            ${latest.score} / ${latest.totalQuestions} (${latest.percentage}%)
          </span>
          <div class="small text-muted" style="font-size: 0.76rem;">${latestDate}</div>
        </div>
      `;
    }

    // Previous Attempt Details
    let prevHtml = `<span class="text-muted small fst-italic">None (First Attempt)</span>`;
    if (prev) {
      const prevDate = new Date(prev.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      prevHtml = `
        <div>
          <span class="fw-bold ${prev.passed ? 'text-success' : 'text-danger'} font-monospace">
            ${prev.score} / ${prev.totalQuestions} (${prev.percentage}%)
          </span>
          <div class="small text-muted" style="font-size: 0.76rem;">${prevDate}</div>
        </div>
      `;
    }

    // Overall Average Column
    // Formula: Average = Total marks obtained / Number of subjects with valid marks
    const avgData = log.candidateAverage || (allCandidateAverages[log.userId] || null);
    let avgHtml = `<span class="text-muted small">—</span>`;
    if (avgData && avgData.validSubjectsCount > 0) {
      avgHtml = `
        <div>
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill font-monospace fw-bold">
            Avg: ${avgData.averageMarks} / 5 (${avgData.averagePercentage}%)
          </span>
          <div class="small text-muted" style="font-size: 0.74rem;">
            Across ${avgData.validSubjectsCount} subject${avgData.validSubjectsCount > 1 ? 's' : ''} (${avgData.totalMarks} total pts)
          </div>
        </div>
      `;
    } else if (latest) {
      avgHtml = `
        <div>
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill font-monospace fw-bold">
            Avg: ${latest.score} / ${latest.totalQuestions} (${latest.percentage}%)
          </span>
          <div class="small text-muted" style="font-size: 0.74rem;">1 subject</div>
        </div>
      `;
    }

    // Improvement Delta
    let deltaBadge = '';
    if (log.scoreImprovement !== null) {
      if (log.scoreImprovement > 0) {
        deltaBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill"><i class="fa-solid fa-arrow-up me-1"></i>+${log.scoreImprovement}%</span>`;
      } else if (log.scoreImprovement < 0) {
        deltaBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill"><i class="fa-solid fa-arrow-down me-1"></i>${log.scoreImprovement}%</span>`;
      } else {
        deltaBadge = `<span class="badge bg-light text-muted border rounded-pill">0% (Equal)</span>`;
      }
    } else {
      deltaBadge = `<span class="badge bg-light text-muted border rounded-pill">N/A</span>`;
    }

    // Attempt Quota Badge
    const quotaBadge = log.isMaxReached
      ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill fw-bold">2 / 2 (MAX)</span>`
      : `<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill fw-bold">1 / 2</span>`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="fw-bold text-heading">${log.userName}</div>
        <div class="small text-muted">${log.userEmail}</div>
      </td>
      <td>
        <span class="fw-semibold">${log.categoryName}${log.quizTitle ? ' (' + log.quizTitle + ')' : ''}</span>
      </td>
      <td>${quotaBadge}</td>
      <td>${prevHtml}</td>
      <td>${latestHtml}</td>
      <td>${avgHtml}</td>
      <td>${deltaBadge}</td>
      <td class="text-end">
        <button class="btn btn-omnix-outline btn-sm" onclick="openAttemptDetailsModal('${latest ? latest.id : ''}')" ${!latest ? 'disabled' : ''}>
          <i class="fa-solid fa-file-lines me-1"></i> Inspect
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

async function openAttemptDetailsModal(attemptId) {
  if (!attemptId) return;

  try {
    const attempt = await API.getAttemptReview(attemptId);

    const titleEl = document.getElementById('modalAttemptUserTitle');
    if (titleEl) {
      titleEl.textContent = `${attempt.userName} • ${attempt.categoryName} (Attempt #${attempt.attemptNumber})`;
    }

    const container = document.getElementById('modalAttemptAnswersList');
    if (container) {
      container.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];

      attempt.answers.forEach((ans, idx) => {
        const item = document.createElement('div');
        item.className = 'border rounded-3 p-3 mb-3 bg-white shadow-xs';

        let optionsHtml = '';
        ans.options.forEach((opt, oIdx) => {
          let style = 'bg-light text-dark';
          let note = '';
          if (oIdx === ans.correctOption) {
            style = 'bg-success-subtle text-success border border-success fw-bold';
            note = ' (Correct)';
          } else if (oIdx === ans.selectedOption && !ans.isCorrect) {
            style = 'bg-danger-subtle text-danger border border-danger fw-bold';
            note = ' (User Choice)';
          }

          optionsHtml += `
            <div class="p-2 rounded mb-1 small ${style}">
              ${letters[oIdx]}. ${opt} ${note}
            </div>
          `;
        });

        item.innerHTML = `
          <div class="d-flex justify-content-between mb-2">
            <span class="fw-bold text-heading small">Q${idx + 1}: ${ans.questionText}</span>
            <span class="badge ${ans.isCorrect ? 'bg-success' : 'bg-danger'}">${ans.isCorrect ? 'Correct' : 'Wrong'}</span>
          </div>
          <div class="mb-2">${optionsHtml}</div>
          <div class="small text-muted bg-light p-2 rounded">
            <strong>Explanation:</strong> ${ans.explanation}
          </div>
        `;
        container.appendChild(item);
      });
    }

    const modal = new bootstrap.Modal(document.getElementById('attemptDetailModal'));
    modal.show();

  } catch (err) {
    showToast('Failed to load attempt details: ' + err.message, 'danger');
  }
}

function setupAdminEventHandlers() {
  const resetBtn = document.getElementById('btn-reset-db');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to restore the platform database to default seed state? All newly created questions and attempts will be reset.')) {
        try {
          await API.resetDatabase();
          showToast('Database reset to clean demo seed state', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
          showToast('Reset failed: ' + err.message, 'danger');
        }
      }
    });
  }
}

window.openAttemptDetailsModal = openAttemptDetailsModal;
