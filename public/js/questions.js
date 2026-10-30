// public/js/questions.js - Admin Quiz & Question CRUD Management + PDF Import Wizard

let loadedCategories = [];
let loadedQuestions = [];

// Wizard State
let wizardState = {
  currentStep: 1,
  domainId: null,
  domainName: null,
  method: null, // 'manual' | 'pdf'
  pdfFile: null,
  extractionResult: null
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.guard('ROLE_ADMIN')) return;

  await loadCategoriesDropdown();
  await loadQuestionsList();
  setupQuestionEvents();
  setupPdfDropzoneEvents();
});

async function loadCategoriesDropdown() {
  try {
    loadedCategories = await API.getCategories();

    // Populate category filter in toolbar
    const filterSelect = document.getElementById('filter-category');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Domains & Categories</option>';
      loadedCategories.forEach(cat => {
        filterSelect.innerHTML += `<option value="${cat.id}">${cat.name} (${cat.questionCount || 0} questions)</option>`;
      });
    }

    // Populate Wizard Domain Select (Step 1)
    const wizardDomainSelect = document.getElementById('wizard-domain-select');
    if (wizardDomainSelect) {
      wizardDomainSelect.innerHTML = '<option value="" disabled selected>-- Choose an Existing Domain / Category --</option>';
      loadedCategories.forEach(cat => {
        wizardDomainSelect.innerHTML += `<option value="${cat.id}">${cat.name} (${cat.difficulty || 'Medium'})</option>`;
      });
    }

    // Populate modal question category selector (Step 3A Manual Form)
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
      (q.quizTitle && q.quizTitle.toLowerCase().includes(searchTerm)) ||
      q.options.some(opt => opt.toLowerCase().includes(searchTerm))
    );
  }

  const countBadge = document.getElementById('questions-total-badge');
  if (countBadge) countBadge.textContent = `${filtered.length} Questions`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fa-solid fa-folder-open fs-2 mb-2 opacity-50"></i>
        <p>No questions found matching your filter. Click "+ Add Question" to create or import questions.</p>
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

    const quizBadge = q.quizTitle 
      ? `<span class="badge bg-light text-dark border ms-1 rounded-pill">${q.quizTitle}</span>` 
      : '';

    tableRows += `
      <tr>
        <td style="width: 50px;" class="text-muted fw-bold">${idx + 1}</td>
        <td>
          <div class="fw-bold text-heading mb-1">${q.questionText}</div>
          <div class="d-flex flex-wrap align-items-center">${optionsPreview}</div>
          <div class="small text-muted mt-1 fst-italic"><strong>Explanation:</strong> ${q.explanation || 'None'}</div>
        </td>
        <td style="width: 200px;">
          <div class="d-flex flex-column gap-1">
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 rounded-pill text-start text-truncate" style="max-width: 180px;">${q.categoryName || 'General'}</span>
            <div>${quizBadge}</div>
          </div>
        </td>
        <td style="width: 130px;" class="text-end">
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
            <th>Domain & Quiz</th>
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

// =========================================================================
// WIZARD STEP NAVIGATION & MODAL CONTROLLERS
// =========================================================================

function openCreateQuestionModal() {
  // Reset wizard state
  wizardState = {
    currentStep: 1,
    domainId: null,
    domainName: null,
    method: null,
    pdfFile: null,
    extractionResult: null
  };

  document.getElementById('questionModalTitle').textContent = 'Add Assessment Questions';
  document.getElementById('wizard-progress-container').classList.remove('d-none');
  document.getElementById('question-id-input').value = '';
  document.getElementById('question-form').reset();

  // Reset file inputs and cards
  clearSelectedPdf();

  // Check if a category filter is currently active in the toolbar
  const activeToolbarFilter = document.getElementById('filter-category').value;
  const domainSelect = document.getElementById('wizard-domain-select');
  if (activeToolbarFilter && loadedCategories.some(c => c.id === activeToolbarFilter)) {
    domainSelect.value = activeToolbarFilter;
    onDomainSelected(activeToolbarFilter);
  } else {
    domainSelect.value = '';
    document.getElementById('btn-domain-next').disabled = true;
    document.getElementById('wizard-domain-preview').classList.add('d-none');
  }

  goToWizardStep(1);

  const modal = new bootstrap.Modal(document.getElementById('questionModal'));
  modal.show();
}

function openEditQuestionModal(qId) {
  const q = loadedQuestions.find(item => item.id === qId);
  if (!q) return;

  // For editing, bypass wizard steps directly to the manual form
  document.getElementById('questionModalTitle').textContent = 'Edit Assessment Question';
  document.getElementById('wizard-progress-container').classList.add('d-none');
  const switchBtn = document.getElementById('btn-manual-switch-method');
  if (switchBtn) switchBtn.classList.add('d-none');

  document.getElementById('question-id-input').value = q.id;
  document.getElementById('question-category-input').value = q.categoryId;
  document.getElementById('manual-domain-badge').textContent = q.categoryName || 'Selected Domain';
  document.getElementById('question-text-input').value = q.questionText;
  document.getElementById('option-a-input').value = q.options[0] || '';
  document.getElementById('option-b-input').value = q.options[1] || '';
  document.getElementById('option-c-input').value = q.options[2] || '';
  document.getElementById('option-d-input').value = q.options[3] || '';
  document.getElementById('correct-option-input').value = q.correctIndex;
  document.getElementById('question-explanation-input').value = q.explanation || '';

  // Show manual panel only
  hideAllWizardPanels();
  document.getElementById('wizard-panel-manual').classList.remove('d-none');

  const modal = new bootstrap.Modal(document.getElementById('questionModal'));
  modal.show();
}

function onDomainSelected(catId) {
  const cat = loadedCategories.find(c => c.id === catId);
  if (!cat) return;

  wizardState.domainId = cat.id;
  wizardState.domainName = cat.name;

  // Show domain preview card in Step 1
  const previewCard = document.getElementById('wizard-domain-preview');
  previewCard.classList.remove('d-none');
  document.getElementById('preview-domain-name').textContent = cat.name;
  document.getElementById('preview-domain-desc').textContent = cat.description || 'Assessment Track';
  document.getElementById('preview-domain-badge').textContent = cat.difficulty || 'Medium';
  document.getElementById('preview-domain-qcount').textContent = `${cat.questionCount || 0} questions currently active`;

  // Enable Next button
  document.getElementById('btn-domain-next').disabled = false;
}

function goToWizardStep(step, subType = null) {
  wizardState.currentStep = step;
  hideAllWizardPanels();

  // Progress Bar navigation state
  updateStepIndicator(step);

  if (step === 1) {
    document.getElementById('wizard-panel-domain').classList.remove('d-none');
    document.getElementById('questionModalTitle').textContent = 'Add Assessment Questions — Step 1';
  } else if (step === 2) {
    if (!wizardState.domainId) {
      showToast('Please select a domain first', 'warning');
      return goToWizardStep(1);
    }
    document.getElementById('chosen-domain-label').textContent = wizardState.domainName;
    document.getElementById('wizard-panel-method').classList.remove('d-none');
    document.getElementById('questionModalTitle').textContent = 'Add Assessment Questions — Step 2';
  } else if (step === 3) {
    const method = subType || wizardState.method || 'manual';
    if (method === 'manual') {
      document.getElementById('manual-domain-badge').textContent = wizardState.domainName;
      document.getElementById('question-category-input').value = wizardState.domainId;
      document.getElementById('btn-manual-switch-method').classList.remove('d-none');
      document.getElementById('wizard-panel-manual').classList.remove('d-none');
      document.getElementById('questionModalTitle').textContent = `Add Assessment Question (${wizardState.domainName})`;
    } else {
      document.getElementById('pdf-domain-badge').textContent = wizardState.domainName;
      document.getElementById('wizard-panel-pdf').classList.remove('d-none');
      document.getElementById('questionModalTitle').textContent = `Import Questions via PDF (${wizardState.domainName})`;
    }
  } else if (step === 4) {
    document.getElementById('wizard-panel-preview').classList.remove('d-none');
    document.getElementById('questionModalTitle').textContent = `Extraction Preview & Quiz Generation (${wizardState.domainName})`;
  }
}

function updateStepIndicator(step) {
  const s1 = document.getElementById('step-nav-1');
  const s2 = document.getElementById('step-nav-2');
  const s3 = document.getElementById('step-nav-3');
  const s4 = document.getElementById('step-nav-4');
  const s4Arrow = document.getElementById('step-nav-4-arrow');

  [s1, s2, s3, s4].forEach(el => {
    if (el) el.className = 'wizard-step-item';
  });

  if (step === 1) {
    s1.classList.add('active');
    s4.classList.add('d-none');
    s4Arrow.classList.add('d-none');
  } else if (step === 2) {
    s1.classList.add('completed');
    s2.classList.add('active');
    s4.classList.add('d-none');
    s4Arrow.classList.add('d-none');
  } else if (step === 3) {
    s1.classList.add('completed');
    s2.classList.add('completed');
    s3.classList.add('active');
    if (wizardState.method === 'pdf') {
      s4.classList.remove('d-none');
      s4Arrow.classList.remove('d-none');
    } else {
      s4.classList.add('d-none');
      s4Arrow.classList.add('d-none');
    }
  } else if (step === 4) {
    s1.classList.add('completed');
    s2.classList.add('completed');
    s3.classList.add('completed');
    s4.classList.remove('d-none');
    s4Arrow.classList.remove('d-none');
    s4.classList.add('active');
  }
}

function hideAllWizardPanels() {
  document.getElementById('wizard-panel-domain').classList.add('d-none');
  document.getElementById('wizard-panel-method').classList.add('d-none');
  document.getElementById('wizard-panel-manual').classList.add('d-none');
  document.getElementById('wizard-panel-pdf').classList.add('d-none');
  document.getElementById('wizard-panel-preview').classList.add('d-none');
}

function selectQuestionMethod(method) {
  wizardState.method = method;
  goToWizardStep(3, method);
}

// =========================================================================
// PDF UPLOAD & EXTRACTION HANDLING
// =========================================================================

function setupPdfDropzoneEvents() {
  const dropzone = document.getElementById('pdf-dropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handlePdfFileSelected(files);
    }
  });

  // Step 1 Domain Dropdown change
  const domainSelect = document.getElementById('wizard-domain-select');
  if (domainSelect) {
    domainSelect.addEventListener('change', (e) => {
      onDomainSelected(e.target.value);
    });
  }
}

function handlePdfFileSelected(files) {
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    showToast('Please select a valid PDF document (.pdf)', 'danger');
    return;
  }

  wizardState.pdfFile = file;

  // Show file card
  const fileCard = document.getElementById('pdf-file-card');
  fileCard.classList.remove('d-none');
  document.getElementById('pdf-file-name').textContent = file.name;
  
  const sizeKb = (file.size / 1024).toFixed(1);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  document.getElementById('pdf-file-size').textContent = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

  // Enable Extract button
  document.getElementById('btn-extract-pdf').disabled = false;
  document.getElementById('pdf-error-banner').classList.add('d-none');
}

function clearSelectedPdf() {
  wizardState.pdfFile = null;
  const fileInput = document.getElementById('pdf-file-input');
  if (fileInput) fileInput.value = '';

  const fileCard = document.getElementById('pdf-file-card');
  if (fileCard) fileCard.classList.add('d-none');

  const extractBtn = document.getElementById('btn-extract-pdf');
  if (extractBtn) extractBtn.disabled = true;

  const errorBanner = document.getElementById('pdf-error-banner');
  if (errorBanner) errorBanner.classList.add('d-none');
}

async function startPdfExtraction() {
  if (!wizardState.pdfFile || !wizardState.domainId) {
    showToast('Please select both a domain and a PDF file', 'warning');
    return;
  }

  const dropzone = document.getElementById('pdf-dropzone');
  const fileCard = document.getElementById('pdf-file-card');
  const progressBox = document.getElementById('pdf-extracting-state');
  const errorBanner = document.getElementById('pdf-error-banner');
  const extractBtn = document.getElementById('btn-extract-pdf');

  try {
    dropzone.classList.add('d-none');
    fileCard.classList.add('d-none');
    errorBanner.classList.add('d-none');
    progressBox.classList.remove('d-none');
    extractBtn.disabled = true;

    // Animated progress status
    document.getElementById('pdf-progress-title').textContent = 'Reading PDF Document...';
    document.getElementById('pdf-progress-desc').textContent = 'Extracting text and identifying question structures across all pages';

    const formData = new FormData();
    formData.append('pdfFile', wizardState.pdfFile);
    formData.append('categoryId', wizardState.domainId);

    setTimeout(() => {
      if (!progressBox.classList.contains('d-none')) {
        document.getElementById('pdf-progress-title').textContent = 'Parsing MCQs & Answer Keys...';
        document.getElementById('pdf-progress-desc').textContent = 'Mapping choices (A, B, C, D) and applying strict 5-question distribution';
      }
    }, 1200);

    const result = await API.extractPdf(formData);
    wizardState.extractionResult = result;

    renderExtractionPreview(result);
    goToWizardStep(4);

  } catch (err) {
    console.error('Extraction error:', err);
    errorBanner.classList.remove('d-none');
    document.getElementById('pdf-error-message').textContent = err.message || 'Failed to extract questions from the PDF.';
  } finally {
    progressBox.classList.add('d-none');
    dropzone.classList.remove('d-none');
    fileCard.classList.remove('d-none');
    extractBtn.disabled = false;
  }
}

// =========================================================================
// STEP 4: EXTRACTION PREVIEW & DISTRIBUTION CONFIRMATION
// =========================================================================

function renderExtractionPreview(data) {
  // Update metric pills
  document.getElementById('preview-stat-extracted').innerHTML = `
    <i class="fa-solid fa-list-check"></i> Total Extracted: <strong>${data.totalExtracted}</strong>
  `;
  document.getElementById('preview-stat-quizzes').innerHTML = `
    <i class="fa-solid fa-layer-group"></i> Quizzes to Create: <strong>${data.quizzesCount}</strong>
  `;
  document.getElementById('preview-stat-used').innerHTML = `
    <i class="fa-solid fa-circle-check"></i> Questions Used: <strong>${data.usedCount}</strong>
  `;
  document.getElementById('preview-stat-ignored').innerHTML = `
    <i class="fa-solid fa-forward"></i> Ignored Remainder: <strong>${data.ignoredCount}</strong>
  `;

  // Duplicate notice
  const dupNotice = document.getElementById('preview-duplicate-notice');
  if (data.isDuplicateNotice) {
    dupNotice.classList.remove('d-none');
  } else {
    dupNotice.classList.add('d-none');
  }

  // Handle Insufficient Questions (< 5 valid questions)
  const insufficientBox = document.getElementById('preview-insufficient-warning');
  const confirmBtn = document.getElementById('btn-confirm-import');

  if (!data.canGenerate || data.quizzesCount === 0) {
    insufficientBox.classList.remove('d-none');
    confirmBtn.disabled = true;
    confirmBtn.classList.add('opacity-50');
  } else {
    insufficientBox.classList.add('d-none');
    confirmBtn.disabled = false;
    confirmBtn.classList.remove('opacity-50');
  }

  // Render Quizzes Accordion (Each containing exactly 5 questions)
  const quizzesContainer = document.getElementById('preview-quizzes-accordion');
  quizzesContainer.innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];

  if (data.quizzes && data.quizzes.length > 0) {
    data.quizzes.forEach((quiz, qzIdx) => {
      let questionsHtml = '';

      quiz.questions.forEach((q, qLocalIdx) => {
        const globalIdx = (qzIdx * 5) + qLocalIdx + 1;
        const optionsInputs = q.options.map((opt, optIdx) => `
          <div class="col-md-6 mb-2">
            <div class="input-group input-group-sm">
              <span class="input-group-text ${optIdx === q.correctIndex ? 'bg-success text-white' : 'bg-light'} fw-bold">${letters[optIdx]}</span>
              <input type="text" class="form-control preview-opt-input" data-quiz="${qzIdx}" data-q="${qLocalIdx}" data-opt="${optIdx}" value="${escapeHtml(opt)}">
            </div>
          </div>
        `).join('');

        questionsHtml += `
          <div class="question-preview-item ${q.needsReview ? 'has-warning' : ''}" id="preview-q-card-${qzIdx}-${qLocalIdx}">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-dark rounded-pill">#${globalIdx}</span>
                <span class="fw-bold small text-heading">Question ${qLocalIdx + 1} of 5</span>
                ${q.needsReview ? `<span class="badge bg-warning-subtle text-warning border border-warning-subtle"><i class="fa-solid fa-triangle-exclamation me-1"></i>${q.reviewReason || 'Review Needed'}</span>` : ''}
              </div>
              <div class="d-flex align-items-center gap-2">
                <label class="small fw-bold text-muted mb-0">Correct Answer:</label>
                <select class="form-select form-select-sm preview-correct-select" data-quiz="${qzIdx}" data-q="${qLocalIdx}" style="width: 110px;">
                  <option value="0" ${q.correctIndex === 0 ? 'selected' : ''}>Option A</option>
                  <option value="1" ${q.correctIndex === 1 ? 'selected' : ''}>Option B</option>
                  <option value="2" ${q.correctIndex === 2 ? 'selected' : ''}>Option C</option>
                  <option value="3" ${q.correctIndex === 3 ? 'selected' : ''}>Option D</option>
                </select>
              </div>
            </div>

            <!-- Editable Question Prompt -->
            <div class="mb-2">
              <textarea class="form-control form-control-sm preview-prompt-input" data-quiz="${qzIdx}" data-q="${qLocalIdx}" rows="2">${escapeHtml(q.questionText)}</textarea>
            </div>

            <!-- 4 Options Inputs -->
            <div class="row g-2 mb-2">
              ${optionsInputs}
            </div>

            <!-- Explanation Input -->
            <div>
              <input type="text" class="form-control form-control-sm text-muted fst-italic preview-expl-input" data-quiz="${qzIdx}" data-q="${qLocalIdx}" placeholder="Explanation / Rationale" value="${escapeHtml(q.explanation || '')}">
            </div>
          </div>
        `;
      });

      const quizGroupCard = document.createElement('div');
      quizGroupCard.className = 'quiz-preview-group';
      quizGroupCard.innerHTML = `
        <div class="quiz-preview-group-header">
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-primary text-white px-2.5 py-1 rounded-pill"><i class="fa-solid fa-bolt me-1"></i>${quiz.quizName}</span>
            <strong class="text-heading">${quiz.questionRange}</strong>
          </div>
          <span class="badge bg-light text-muted border px-2.5 py-1">Exactly 5 Questions</span>
        </div>
        <div class="quiz-preview-group-body">
          ${questionsHtml}
        </div>
      `;
      quizzesContainer.appendChild(quizGroupCard);
    });
  }

  // Render Ignored Questions Container (Remainder questions beyond groups of 5)
  const ignoredContainer = document.getElementById('preview-ignored-container');
  if (data.ignoredQuestions && data.ignoredQuestions.length > 0) {
    ignoredContainer.classList.remove('d-none');
    let ignoredItems = '';
    data.ignoredQuestions.forEach((q, idx) => {
      ignoredItems += `
        <div class="p-2.5 border-bottom bg-light">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="badge bg-secondary text-white rounded-pill">Ignored #${data.usedCount + idx + 1}</span>
            <span class="small text-muted"><i class="fa-solid fa-clock-rotate-left me-1"></i>Excluded: Remainder beyond 5-group quota</span>
          </div>
          <div class="small fw-semibold text-truncate text-muted">${q.questionText}</div>
        </div>
      `;
    });

    ignoredContainer.innerHTML = `
      <div class="card border border-warning-subtle rounded-3 overflow-hidden">
        <div class="card-header bg-warning-subtle py-2 d-flex justify-content-between align-items-center">
          <div class="fw-bold text-warning-emphasis small">
            <i class="fa-solid fa-forward me-1"></i> Ignored Remainder Questions (${data.ignoredQuestions.length})
          </div>
          <span class="badge bg-warning text-dark">${data.ignoredQuestions.length} Ignored</span>
        </div>
        <div class="card-body p-0">
          ${ignoredItems}
        </div>
      </div>
    `;
  } else {
    ignoredContainer.classList.add('d-none');
  }

  // Render Invalid / Review Needed Questions
  const reviewContainer = document.getElementById('preview-invalid-container');
  if (data.invalidQuestions && data.invalidQuestions.length > 0) {
    reviewContainer.classList.remove('d-none');
    let invalidItems = '';
    data.invalidQuestions.forEach((q, idx) => {
      invalidItems += `
        <div class="p-2 border-bottom">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge bg-danger rounded-pill">Invalid #${idx + 1}</span>
            <span class="small text-danger fw-bold">${q.reviewReason || 'Formatting error'}</span>
          </div>
          <div class="small text-muted">${escapeHtml(q.questionText || 'Empty prompt text')}</div>
        </div>
      `;
    });

    reviewContainer.innerHTML = `
      <div class="card border-danger-subtle rounded-3 overflow-hidden">
        <div class="card-header bg-danger-subtle text-danger py-2 fw-bold small">
          <i class="fa-solid fa-triangle-exclamation me-1"></i> Unparseable PDF Items (${data.invalidQuestions.length})
        </div>
        <div class="card-body p-0">
          ${invalidItems}
        </div>
      </div>
    `;
  } else {
    reviewContainer.classList.add('d-none');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function confirmAndSavePdfQuizzes() {
  if (!wizardState.extractionResult || !wizardState.extractionResult.quizzes) {
    showToast('No quizzes to save', 'warning');
    return;
  }

  const confirmBtn = document.getElementById('btn-confirm-import');

  try {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating & Saving Quizzes...';

    // Collect latest edited values from preview inputs
    const updatedQuizzes = JSON.parse(JSON.stringify(wizardState.extractionResult.quizzes));

    updatedQuizzes.forEach((quiz, qzIdx) => {
      quiz.questions.forEach((q, qLocalIdx) => {
        const promptEl = document.querySelector(`.preview-prompt-input[data-quiz="${qzIdx}"][data-q="${qLocalIdx}"]`);
        if (promptEl) q.questionText = promptEl.value.trim();

        const correctSelect = document.querySelector(`.preview-correct-select[data-quiz="${qzIdx}"][data-q="${qLocalIdx}"]`);
        if (correctSelect) q.correctIndex = parseInt(correctSelect.value, 10);

        const explEl = document.querySelector(`.preview-expl-input[data-quiz="${qzIdx}"][data-q="${qLocalIdx}"]`);
        if (explEl) q.explanation = explEl.value.trim();

        for (let optIdx = 0; optIdx < 4; optIdx++) {
          const optEl = document.querySelector(`.preview-opt-input[data-quiz="${qzIdx}"][data-q="${qLocalIdx}"][data-opt="${optIdx}"]`);
          if (optEl) q.options[optIdx] = optEl.value.trim();
        }
      });
    });

    const payload = {
      categoryId: wizardState.domainId,
      fileName: wizardState.extractionResult.fileName,
      fileHash: wizardState.extractionResult.fileHash,
      force: true, // User intentionally confirmed in UI
      quizzes: updatedQuizzes
    };

    const res = await API.importPdfQuizzes(payload);
    showToast(res.message || 'Quizzes generated successfully!', 'success');

    // Close modal
    const modalEl = document.getElementById('questionModal');
    bootstrap.Modal.getInstance(modalEl).hide();

    // Reload categories and question tables
    await loadCategoriesDropdown();
    await loadQuestionsList();

  } catch (err) {
    console.error('Error saving quizzes:', err);
    showToast('Failed to save generated quizzes: ' + err.message, 'danger');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i class="fa-solid fa-check-double me-1"></i> Confirm & Save Quizzes';
  }
}

// =========================================================================
// QUESTION FORM & CATEGORY MANAGEMENT
// =========================================================================

function setupQuestionEvents() {
  // Category filter change in toolbar
  const filterCat = document.getElementById('filter-category');
  if (filterCat) {
    filterCat.addEventListener('change', () => loadQuestionsList());
  }

  // Search input
  const searchInput = document.getElementById('search-question-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderQuestionsTable());
  }

  // Question Form Submission (Create or Edit single question manually)
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
  if (!confirm('Warning: Deleting this category will delete all associated questions, quizzes, and attempts. Continue?')) return;

  try {
    await API.deleteCategory(catId);
    showToast('Category deleted successfully', 'success');
    await loadCategoriesDropdown();
    await loadQuestionsList();
  } catch (err) {
    showToast('Error deleting category: ' + err.message, 'danger');
  }
}

// Global Exports
window.openCreateQuestionModal = openCreateQuestionModal;
window.openEditQuestionModal = openEditQuestionModal;
window.goToWizardStep = goToWizardStep;
window.selectQuestionMethod = selectQuestionMethod;
window.handlePdfFileSelected = handlePdfFileSelected;
window.clearSelectedPdf = clearSelectedPdf;
window.startPdfExtraction = startPdfExtraction;
window.confirmAndSavePdfQuizzes = confirmAndSavePdfQuizzes;
window.deleteQuestion = deleteQuestion;
window.deleteCategory = deleteCategory;
