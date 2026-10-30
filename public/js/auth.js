// public/js/auth.js - Authentication State, RBAC Guards, and Session Management

const Auth = {
  initNavbar() {
    const user = API.getUser();
    const navUserContainer = document.getElementById('nav-user-container');
    const navGuestContainer = document.getElementById('nav-guest-container');

    if (user && navUserContainer) {
      if (navGuestContainer) navGuestContainer.classList.add('d-none');
      navUserContainer.classList.remove('d-none');

      const userNameEl = document.getElementById('nav-user-name');
      const userRoleBadge = document.getElementById('nav-user-role');
      if (userNameEl) userNameEl.textContent = user.name;
      if (userRoleBadge) {
        userRoleBadge.textContent = user.role === 'ROLE_ADMIN' ? 'ADMIN' : 'STUDENT';
        userRoleBadge.className = user.role === 'ROLE_ADMIN' 
          ? 'badge bg-dark text-white rounded-pill ms-2 px-2 py-1' 
          : 'badge bg-primary text-white rounded-pill ms-2 px-2 py-1';
      }

      // Show Admin portal link if user has admin privileges
      const adminNavLinks = document.querySelectorAll('.admin-nav-item');
      adminNavLinks.forEach(el => {
        if (user.role === 'ROLE_ADMIN') {
          el.classList.remove('d-none');
        } else {
          el.classList.add('d-none');
        }
      });
    } else if (navGuestContainer) {
      if (navUserContainer) navUserContainer.classList.add('d-none');
      navGuestContainer.classList.remove('d-none');
    }

    // Attach logout buttons
    document.querySelectorAll('.btn-logout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    });
  },

  guard(requiredRole = null) {
    const user = API.getUser();

    // If not logged in at all
    if (!user) {
      window.location.href = 'index.html?authRequired=true';
      return false;
    }

    // If specific role required (e.g. ROLE_ADMIN)
    if (requiredRole && user.role !== requiredRole) {
      if (requiredRole === 'ROLE_ADMIN') {
        alert('Access Denied: You require Administrator privileges to access this portal.');
        window.location.href = 'user-dashboard.html';
        return false;
      }
    }

    return true;
  },

  logout() {
    API.clearSession();
    window.location.href = 'index.html?loggedOut=true';
  },

  setupAuthModals() {
    // User login form
    const userLoginForm = document.getElementById('user-login-form');
    if (userLoginForm) {
      userLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('user-login-email').value.trim();
        const password = document.getElementById('user-login-password').value;
        const submitBtn = userLoginForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
          const res = await API.login(email, password, 'ROLE_USER');
          API.setSession(res.token, res.user);
          showToast('Welcome back, ' + res.user.name, 'success');
          setTimeout(() => {
            window.location.href = 'user-dashboard.html';
          }, 800);
        } catch (err) {
          showToast(err.message, 'danger');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Sign In';
        }
      });
    }

    // User register form
    const userRegisterForm = document.getElementById('user-register-form');
    if (userRegisterForm) {
      userRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('user-reg-name').value.trim();
        const email = document.getElementById('user-reg-email').value.trim();
        const password = document.getElementById('user-reg-password').value;
        const submitBtn = userRegisterForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';
          const res = await API.register(name, email, password);
          API.setSession(res.token, res.user);
          showToast('Account created successfully! Welcome to QuizCraft.', 'success');
          setTimeout(() => {
            window.location.href = 'user-dashboard.html';
          }, 800);
        } catch (err) {
          showToast(err.message, 'danger');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Create Account';
        }
      });
    }

    // Admin login form
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-login-email').value.trim();
        const password = document.getElementById('admin-login-password').value;
        const submitBtn = adminLoginForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';
          const res = await API.login(email, password, 'ROLE_ADMIN');
          API.setSession(res.token, res.user);
          showToast('Admin authenticated successfully!', 'success');
          setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
          }, 800);
        } catch (err) {
          showToast(err.message, 'danger');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Access Admin Console';
        }
      });
    }

    // Demo Fill Shortcuts
    const btnDemoUser = document.getElementById('btn-fill-demo-user');
    if (btnDemoUser) {
      btnDemoUser.addEventListener('click', () => {
        document.getElementById('user-login-email').value = 'user@omnix.com';
        document.getElementById('user-login-password').value = 'user123';
        showToast('Demo User credentials filled', 'info');
      });
    }

    const btnDemoAdmin = document.getElementById('btn-fill-demo-admin');
    if (btnDemoAdmin) {
      btnDemoAdmin.addEventListener('click', () => {
        document.getElementById('admin-login-email').value = 'admin@omnix.com';
        document.getElementById('admin-login-password').value = 'admin123';
        showToast('Demo Admin credentials filled', 'info');
      });
    }
  }
};

window.Auth = Auth;

// Auto-run navbar setup on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Auth.initNavbar();
});
