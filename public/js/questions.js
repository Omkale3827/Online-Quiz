// public/js/questions.js - Admin Quiz & Question CRUD Management

let loadedCategories = [];
let loadedQuestions = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.guard('ROLE_ADMIN')) return;

  await loadCategoriesDropdown();
  await loadQuestionsList();
  setupQuestionEvents();
});

async function loadCategoriesDropdown() {
  try {
    loadedCategories = await API.getCategories();

    // Populate category filter
    const filterSelect = document.getElementById('filter-category');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Domains & Categories</option>';
      loadedCategories.forEach(cat => {
        filterSelect.innerHTML += `<option value="${cat.id}">${cat.name} (${cat.questionCount || 0} questions)</option>`;
      });
    }

    // Populate modal question category selector
    const modalSelect = document.getElementById('question-category-input');
    if (modalSelect) {
      modalSelect.innerHTML = '<option value="" disabled selected>Select Category Domain</option>';
      loadedCategories.forEach(cat => {
        modalSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      });
    }

    // Populate category manager table
    renderCategoryManagerTable();

  } catch (err) {
    console.error('Error loading categories:', err);
    showToast('Failed to load categories', 'danger');
  }
}

async function loadQuestionsList() {
  const container = document.getElementById('questions-list-container');
  if (!container) return;

  try {
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="text-muted mt-2">Loading active question bank...</div>
      </div>
    `;

    const catFilter = document.getElementById('filter-category') ? document.getElementById('filter-category').value : '';
    loadedQuestions = await API.getQuestions(catFilter || null);

    renderQuestionsTable();

  } catch (err) {
    container.innerHTML = `
      <div class="text-center py-5 text-danger">
        <p>Failed to load questions: ${err.message}</p>
      </div>
    `;
  }
}

function renderQuestionsTable() {
  const container = document.getElementById('questions-list-container');
  const searchInput = document.getElementById('search-question-input');
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = loadedQuestions;
  if (searchTerm) {
    filtered = filtered.filter(q => 
      q.questionText.toLowerCase().includes(searchTerm) || 
      (q.categoryName && q.categoryName.toLowerCase().includes(searchTerm)) ||
      q.options.some(opt => opt.toLowerCase().includes(searchTerm))
    );
  }

  const countBadge = document.getElementById('questions-total-badge');
  if (countBadge) countBadge.textContent = `${filtered.length} Questions`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fa-solid fa-folder-open fs-2 mb-2 opacity-50"></i>
        <p>No questions found matching your filter. Click "+ Add New Question" to create one.</p>
      </div>
    `;
    return;
  }

  const letters = ['A', 'B', 'C', 'D'];
  let tableRows = '';

  filtered.forEach((q, idx) => {
    const optionsPreview = q.options.map((opt, oIdx) => {
      const isCorrect = oIdx === q.correctIndex;
      return `
        <span class="badge ${isCorrect ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-light text-muted border'} me-1 mb-1">
          ${letters[oIdx]}: ${opt} ${isCorrect ? '✓' : ''}
        </span>
      `;
    }).join('');

    tableRows += `
      <tr>
        <td style="width: 50px;" class="text-muted fw-bold">${idx + 1}</td>
        <td>
          <div class="fw-bold text-heading mb-1">${q.questionText}</div>
          <div class="d-flex flex-wrap align-items-center">${optionsPreview}</div>
          <div class="small text-muted mt-1 fst-italic"><strong>Explanation:</strong> ${q.explanation || 'None'}</div>
        </td>
        <td style="width: 170px;">
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 rounded-pill">${q.categoryName || 'General'}</span>
        </td>
        <td style="width: 140px;" class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditQuestionModal('${q.id}')" title="Edit Question">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteQuestion('${q.id}')" title="Delete Question">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-omnix mb-0">
        <thead>
          <tr>
            <th>#</th>
            <th>Question Prompt & Options</th>
            <th>Category</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

function setupQuestionEvents() {
  // Category filter change
  const filterCat = document.getElementById('filter-category');
  if (filterCat) {
    filterCat.addEventListener('change', () => loadQuestionsList());
  }

  // Search input
  const searchInput = document.getElementById('search-question-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderQuestionsTable());
  }

  // Question Form Submission (Create or Edit)
  const qForm = document.getElementById('question-form');
  if (qForm) {
    qForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const qId = document.getElementById('question-id-input').value;
      const categoryId = document.getElementById('question-category-input').value;
      const questionText = document.getElementById('question-text-input').value.trim();
      const optA = document.getElementById('option-a-input').value.trim();
      const optB = document.getElementById('option-b-input').value.trim();
      const optC = document.getElementById('option-c-input').value.trim();
      const optD = document.getElementById('option-d-input').value.trim();
      const correctIndex = parseInt(document.getElementById('correct-option-input').value, 10);
      const explanation = document.getElementById('question-explanation-input').value.trim();

      const payload = {
        categoryId,
        questionText,
        options: [optA, optB, optC, optD],
        correctIndex,
        explanation
      };

      const submitBtn = qForm.querySelector('button[type="submit"]');

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

        if (qId) {
          // Update
          await API.updateQuestion(qId, payload);
          showToast('Question updated successfully!', 'success');
        } else {
          // Create
          await API.createQuestion(payload);
          showToast('New question added successfully!', 'success');
        }

        const modalEl = document.getElementById('questionModal');
        bootstrap.Modal.getInstance(modalEl).hide();

        await loadCategoriesDropdown();
        await loadQuestionsList();

      } catch (err) {
        showToast('Error saving question: ' + err.message, 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Question';
      }
    });
  }

  // Category Form Submission
  const catForm = document.getElementById('category-form');
  if (catForm) {
    catForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('category-name-input').value.trim();
      const difficulty = document.getElementById('category-difficulty-input').value;
      const totalTimeMinutes = parseInt(document.getElementById('category-time-input').value, 10) || 5;
      const description = document.getElementById('category-desc-input').value.trim();

      try {
        await API.createCategory({ name, difficulty, totalTimeMinutes, description });
        showToast('Category created successfully!', 'success');
        catForm.reset();
        await loadCategoriesDropdown();
        await loadQuestionsList();
      } catch (err) {
        showToast('Error: ' + err.message, 'danger');
      }
    });
  }
}

function openCreateQuestionModal() {
  document.getElementById('questionModalTitle').textContent = 'Add New Assessment Question';
  document.getElementById('question-id-input').value = '';
  document.getElementById('question-form').reset();

  const currentCatFilter = document.getElementById('filter-category').value;
  if (currentCatFilter) {
    document.getElementById('question-category-input').value = currentCatFilter;
  }

  const modal = new bootstrap.Modal(document.getElementById('questionModal'));
  modal.show();
}

function openEditQuestionModal(qId) {
  const q = loadedQuestions.find(item => item.id === qId);
  if (!q) return;

  document.getElementById('questionModalTitle').textContent = 'Edit Assessment Question';
  document.getElementById('question-id-input').value = q.id;
  document.getElementById('question-category-input').value = q.categoryId;
  document.getElementById('question-text-input').value = q.questionText;
  document.getElementById('option-a-input').value = q.options[0] || '';
  document.getElementById('option-b-input').value = q.options[1] || '';
  document.getElementById('option-c-input').value = q.options[2] || '';
  document.getElementById('option-d-input').value = q.options[3] || '';
  document.getElementById('correct-option-input').value = q.correctIndex;
  document.getElementById('question-explanation-input').value = q.explanation || '';

  const modal = new bootstrap.Modal(document.getElementById('questionModal'));
  modal.show();
}

async function deleteQuestion(qId) {
  if (!confirm('Are you sure you want to permanently delete this question?')) return;

  try {
    await API.deleteQuestion(qId);
    showToast('Question deleted successfully', 'success');
    await loadCategoriesDropdown();
    await loadQuestionsList();
  } catch (err) {
    showToast('Error deleting question: ' + err.message, 'danger');
  }
}

function renderCategoryManagerTable() {
  const tbody = document.getElementById('categories-manager-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  loadedCategories.forEach(cat => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${cat.name}</strong></td>
      <td><span class="badge-pill badge-${cat.difficulty.toLowerCase()}">${cat.difficulty}</span></td>
      <td>${cat.totalTimeMinutes} mins</td>
      <td>${cat.questionCount || 0}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${cat.id}')" title="Delete Category">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function deleteCategory(catId) {
  if (!confirm('Warning: Deleting this category will delete all associated questions and attempts. Continue?')) return;

  try {
    await API.deleteCategory(catId);
    showToast('Category deleted successfully', 'success');
    await loadCategoriesDropdown();
    await loadQuestionsList();
  } catch (err) {
    showToast('Error deleting category: ' + err.message, 'danger');
  }
}

window.openCreateQuestionModal = openCreateQuestionModal;
window.openEditQuestionModal = openEditQuestionModal;
window.deleteQuestion = deleteQuestion;
window.deleteCategory = deleteCategory;
