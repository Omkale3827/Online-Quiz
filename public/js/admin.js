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

async function loadDetailedSubmissionLogs() {
  const tableBody = document.getElementById('admin-attempts-table-body');
  if (!tableBody) return;

  try {
    const data = await API.getAdminAttempts();
    const logs = data.userQuizLogs || [];
    tableBody.innerHTML = '';

    if (logs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted">No quiz submission logs recorded yet.</td>
        </tr>
      `;
      return;
    }

    logs.forEach(log => {
      // Latest Attempt details
      const latest = log.latestAttempt;
      const prev = log.previousAttempt;

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
            <span class="fw-bold ${latest.passed ? 'text-success' : 'text-danger'}">${latest.score}/${latest.totalQuestions} (${latest.percentage}%)</span>
            <div class="small text-muted" style="font-size: 0.76rem;">${latestDate}</div>
          </div>
        `;
      }

      // Previous Attempt details
      let prevHtml = `<span class="text-muted small italic">None (First Attempt)</span>`;
      if (prev) {
        const prevDate = new Date(prev.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        prevHtml = `
          <div>
            <span class="fw-bold ${prev.passed ? 'text-success' : 'text-danger'}">${prev.score}/${prev.totalQuestions} (${prev.percentage}%)</span>
            <div class="small text-muted" style="font-size: 0.76rem;">${prevDate}</div>
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

      // Attempt quota badge
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
          <span class="fw-semibold">${log.categoryName}</span>
        </td>
        <td>${quotaBadge}</td>
        <td>${prevHtml}</td>
        <td>${latestHtml}</td>
        <td>${deltaBadge}</td>
        <td class="text-end">
          <button class="btn btn-omnix-outline btn-sm" onclick="openAttemptDetailsModal('${latest ? latest.id : ''}')">
            <i class="fa-solid fa-file-lines me-1"></i> Inspect
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  } catch (err) {
    console.error('Error loading submissions:', err);
  }
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
