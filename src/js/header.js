/**
 * Loads the shared site header, applies the saved theme, and wires the header UI.
 */
(function initializeSharedHeader() {
  const HEADER_PARTIAL_PATH = '/src/partials/header.html';
  const THEME_STORAGE_KEY = 'site-theme';

  function getStoredTheme() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  }

  function applyTheme(theme) {
    const isLightTheme = theme === 'light';
    document.documentElement.classList.toggle('light-theme', isLightTheme);

    document.querySelectorAll('[data-theme-option]').forEach((button) => {
      const isActive = button.dataset.themeOption === theme;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  function toggleMobileNavigation() {
    const navList = document.getElementById('nav-list');
    const navToggleButton = document.querySelector('.nav-toggle');

    if (!navList || !navToggleButton) {
      return;
    }

    const isOpen = navList.classList.toggle('show');
    navToggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function closeMobileNavigation() {
    const navList = document.getElementById('nav-list');
    const navToggleButton = document.querySelector('.nav-toggle');

    if (!navList || !navToggleButton) {
      return;
    }

    navList.classList.remove('show');
    navToggleButton.setAttribute('aria-expanded', 'false');
  }

  function markActiveLink(page) {
    const pages = [page, document.body.dataset.pageParent].filter(Boolean);

    if (!pages.length) {
      return;
    }

    document.querySelectorAll('[data-nav-link]').forEach((link) => {
      if (pages.includes(link.dataset.navLink)) {
        link.classList.add('nav-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function closeOpenDropdowns() {
    closeMobileNavigation();

    document.querySelectorAll('.nav-dropdown.open').forEach((dropdown) => {
      dropdown.classList.remove('open');

      const dropdownButton = dropdown.querySelector('.nav-dropdown-btn');
      if (dropdownButton) {
        dropdownButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function bindHeaderControls() {
    document.querySelectorAll('[data-theme-option]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextTheme = button.dataset.themeOption === 'light' ? 'light' : 'dark';
        applyTheme(nextTheme);

        if (typeof window.onThemeToggle === 'function') {
          window.onThemeToggle();
        }
      });
    });

    const navToggleButton = document.querySelector('.nav-toggle');
    if (navToggleButton) {
      navToggleButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMobileNavigation();
      });
    }

    document.querySelectorAll('#nav-list a').forEach((link) => {
      link.addEventListener('click', closeMobileNavigation);
    });

    document.querySelectorAll('.nav-dropdown-btn').forEach((dropdownButton) => {
      dropdownButton.addEventListener('click', (event) => {
        event.stopPropagation();

        const dropdown = dropdownButton.closest('.nav-dropdown');
        if (!dropdown) {
          return;
        }

        const isOpen = dropdown.classList.toggle('open');
        dropdownButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });

    document.addEventListener('click', closeOpenDropdowns);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeOpenDropdowns();
      }
    });
  }

  async function injectHeader() {
    const headerPlaceholder = document.getElementById('site-header');
    if (!headerPlaceholder) {
      return;
    }

    try {
      const response = await fetch(HEADER_PARTIAL_PATH);
      if (!response.ok) {
        throw new Error(`Header request failed with ${response.status}`);
      }

      headerPlaceholder.outerHTML = await response.text();
      applyTheme(getStoredTheme());
      bindHeaderControls();
      markActiveLink(document.body.dataset.page);
    } catch (error) {
      console.warn('header.js: could not load header partial', error);
    }
  }

  applyTheme(getStoredTheme());
  document.addEventListener('DOMContentLoaded', injectHeader);
})();
