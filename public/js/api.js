// public/js/api.js - Central API Client & State Management for QuizCraft

const API_BASE = '/api';

const API = {
  // Token & User helpers
  getToken() {
    return localStorage.getItem('omnix_token') || sessionStorage.getItem('omnix_token');
  },

  getUser() {
    const raw = localStorage.getItem('omnix_user') || sessionStorage.getItem('omnix_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setSession(token, user, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('omnix_token', token);
    storage.setItem('omnix_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('omnix_token');
    localStorage.removeItem('omnix_user');
    sessionStorage.removeItem('omnix_token');
    sessionStorage.removeItem('omnix_user');
  },

  // Base fetch request wrapper
  async request(endpoint, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error.message);
      throw error;
    }
  },

  // Auth endpoints
  async login(email, password, requestedRole) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, requestedRole })
    });
  },

  async register(name, email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  },

  async getMe() {
    return this.request('/auth/me');
  },

  // Categories
  async getCategories() {
    return this.request('/categories');
  },

  async createCategory(catData) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(catData)
    });
  },

  async updateCategory(id, catData) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(catData)
    });
  },

  async deleteCategory(id) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE'
    });
  },

  // Questions
  async getQuestions(categoryId = null) {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    return this.request(`/questions${query}`);
  },

  async createQuestion(questionData) {
    return this.request('/questions', {
      method: 'POST',
      body: JSON.stringify(questionData)
    });
  },

  async updateQuestion(id, questionData) {
    return this.request(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(questionData)
    });
  },

  async deleteQuestion(id) {
    return this.request(`/questions/${id}`, {
      method: 'DELETE'
    });
  },

  // PDF Extraction & Bulk Quiz Generation
  async extractPdf(formData) {
    return this.request('/questions/extract-pdf', {
      method: 'POST',
      body: formData
    });
  },

  async importPdfQuizzes(payload) {
    return this.request('/questions/import-pdf-quizzes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getQuizzes(categoryId = null) {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    return this.request(`/questions/quizzes${query}`);
  },

  // Quizzes & Attempts
  async getQuizStatus(categoryId, userId = null, quizId = null) {
    const uid = userId || (this.getUser() ? this.getUser().id : '');
    const params = new URLSearchParams();
    if (uid) params.append('userId', uid);
    if (quizId) params.append('quizId', quizId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/quizzes/${categoryId}/status${query}`);
  },

  async getQuizQuestions(categoryId, quizId = null) {
    const user = this.getUser();
    const params = new URLSearchParams();
    if (user) params.append('userId', user.id);
    if (quizId) params.append('quizId', quizId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/quizzes/${categoryId}/questions${query}`);
  },

  async lockAnswer(categoryId, questionId, selectedOption, isSkipped = false) {
    return this.request(`/quizzes/${categoryId}/lock-answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedOption, isSkipped })
    });
  },

  async useLifeline5050(categoryId, questionId) {
    return this.request(`/quizzes/${categoryId}/lifeline-5050`, {
      method: 'POST',
      body: JSON.stringify({ questionId })
    });
  },

  async useLifelineChange(categoryId, currentQuestionId, usedQuestionIds = []) {
    return this.request(`/quizzes/${categoryId}/lifeline-change`, {
      method: 'POST',
      body: JSON.stringify({ currentQuestionId, usedQuestionIds })
    });
  },

  async submitQuiz(categoryId, answers, quizId = null, lifelinesUsed = {}) {
    const user = this.getUser();
    return this.request(`/quizzes/${categoryId}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        userId: user ? user.id : null,
        quizId,
        answers,
        lifelinesUsed
      })
    });
  },

  async getAttemptReview(attemptId) {
    return this.request(`/quizzes/attempt/${attemptId}`);
  },

  async getUserQuizAttempts(categoryId) {
    const user = this.getUser();
    const query = user ? `?userId=${encodeURIComponent(user.id)}` : '';
    return this.request(`/quizzes/${categoryId}/attempts${query}`);
  },

  // Admin
  async getAdminAnalytics() {
    return this.request('/admin/analytics');
  },

  async getAdminUsers() {
    return this.request('/admin/users');
  },

  async getAdminAttempts(filterParams = {}) {
    const params = new URLSearchParams();
    if (filterParams.subject && filterParams.subject !== 'all') params.append('subject', filterParams.subject);
    if (filterParams.sortBy && filterParams.sortBy !== 'default') params.append('sortBy', filterParams.sortBy);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/admin/attempts${query}`);
  },

  async resetDatabase() {
    return this.request('/admin/reset', {
      method: 'POST'
    });
  }
};

// UI Notification Toast Helper
function showToast(message, type = 'primary') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `omnix-toast toast-${type}`;

  const iconClass = type === 'success' ? 'fa-circle-check text-success' :
                    type === 'danger' ? 'fa-circle-xmark text-danger' :
                    type === 'warning' ? 'fa-triangle-exclamation text-warning' :
                    'fa-circle-info text-primary';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} fs-5 mt-1"></i>
    <div class="flex-grow-1">
      <div class="fw-semibold small text-uppercase" style="letter-spacing: 0.05em; color: var(--text-muted);">${type}</div>
      <div class="text-heading small mt-0.5">${message}</div>
    </div>
    <button type="button" class="btn-close btn-close-sm" aria-label="Close" onclick="this.parentElement.remove()"></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slide-toast 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

// Make accessible globally
window.API = API;
window.showToast = showToast;
