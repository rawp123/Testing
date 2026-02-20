/**
 * header.js — loads the shared header partial into #site-header on every page,
 * then wires up theme toggle, mobile nav toggle, and active nav link.
 */
(function () {
  // ── Theme helpers (must run before injection so theme applies immediately) ──
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
    }
    // Update toggle icon if it exists yet
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '☀️' : '🌙';
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
    localStorage.setItem('site-theme', theme);
  }

  // Apply saved theme immediately (before header even loads) to avoid flash
  const savedTheme = localStorage.getItem('site-theme') || 'dark';
  applyTheme(savedTheme);

  // ── Mobile nav toggle ──
  function toggleNav() {
    const list = document.getElementById('nav-list');
    const btn  = document.querySelector('.nav-toggle');
    if (!list || !btn) return;
    const open = list.classList.toggle('show');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // ── Set active link ──
  function setActiveLink(page) {
    if (!page) return;
    document.querySelectorAll('[data-nav-link]').forEach(function (a) {
      if (a.dataset.navLink === page) {
        a.classList.add('nav-active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  // ── Load and inject header ──
  document.addEventListener('DOMContentLoaded', function () {
    const placeholder = document.getElementById('site-header');
    if (!placeholder) return;

    fetch('/src/partials/header.html')
      .then(function (res) { return res.text(); })
      .then(function (html) {
        placeholder.outerHTML = html;

        // Re-apply theme so icon text is updated now that the button exists
        applyTheme(localStorage.getItem('site-theme') || 'dark');

        // Wire theme toggle
        var themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
          themeBtn.addEventListener('click', function () {
            var isLight = document.documentElement.classList.contains('light-theme');
            applyTheme(isLight ? 'dark' : 'light');
            // If the dashboard's own updateDashboard exists, let it re-render too
            if (typeof window.onThemeToggle === 'function') window.onThemeToggle();
          });
        }

        // Wire mobile nav toggle
        var navBtn = document.querySelector('.nav-toggle');
        if (navBtn) navBtn.addEventListener('click', toggleNav);

        // Wire dropdown toggles
        document.querySelectorAll('.nav-dropdown-btn').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var li = btn.closest('.nav-dropdown');
            var isOpen = li.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          });
        });
        document.addEventListener('click', function () {
          document.querySelectorAll('.nav-dropdown.open').forEach(function (li) {
            li.classList.remove('open');
            var btn = li.querySelector('.nav-dropdown-btn');
            if (btn) btn.setAttribute('aria-expanded', 'false');
          });
        });

        // Set active link
        setActiveLink(document.body.dataset.page);
      })
      .catch(function (err) {
        console.warn('header.js: could not load header partial', err);
      });
  });
})();
