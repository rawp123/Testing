/**
 * Loads the shared site header, applies the saved theme, and wires the header UI.
 */
(function initializeSharedHeader() {
  const HEADER_PARTIAL_PATH = '/src/partials/header.html';
  const PAGE_REGISTRY_PATH = '/src/config/site-pages.json';
  const THEME_STORAGE_KEY = 'site-theme';
  const FALLBACK_REGISTRY = {
    pages: [
      { id: 'home', label: 'Home', href: '/', status: 'online', nav: false },
      { id: 'dashboard', label: 'JPML Dashboard', href: '/jpml-dashboard.html', status: 'online' },
      { id: 'podcast-utility', label: 'All-In Search', href: '/all-in-podcast-search/', status: 'online' },
      { id: 'wip-nuclear-verdict-tracker', label: 'Nuclear Verdict Tracker', href: '/work-in-progress/nuclear-verdict-tracker/', status: 'online', parent: 'work-in-progress' },
      { id: 'wip-silly-word-builder', label: 'Silly Word Builder', href: '/work-in-progress/silly-word-builder/', status: 'online', parent: 'work-in-progress' },
      { id: 'db-diagram', label: 'Database Diagram Builder', href: '/db-diagram/', status: 'online' },
      { id: 'game-lab', label: 'Game Lab', href: '/games/', status: 'online' },
      { id: 'game', label: 'Happy Math', href: '/games/happy-math/', status: 'online', parent: 'game-lab' },
      { id: 'find-the-ball', label: 'Find the Ball', href: '/games/find-the-ball/', status: 'online', parent: 'game-lab' },
      { id: 'math-meteor-shower', label: 'Math Meteor Shower', href: '/games/math-meteor-shower/', status: 'online', parent: 'game-lab' },
      { id: 'contact', label: 'Contact', href: '/contact/', status: 'online' }
    ],
    navigation: [
      { page: 'dashboard' },
      { page: 'podcast-utility' },
      { group: 'work-in-progress', label: 'Work In Progress', pages: ['wip-nuclear-verdict-tracker', 'wip-silly-word-builder'] },
      { group: 'tools', label: 'Tools', pages: ['db-diagram'] },
      { group: 'games', label: 'Games', pages: ['game-lab', 'game', 'find-the-ball', 'math-meteor-shower'] },
      { page: 'contact' }
    ]
  };

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

  function isOnline(page) {
    return page && page.status !== 'offline' && page.nav !== false;
  }

  function buildPageMap(registry) {
    return new Map((registry.pages || []).map((page) => [page.id, page]));
  }

  function createNavLink(page) {
    const link = document.createElement('a');
    link.href = page.href;
    link.dataset.navLink = page.id;
    link.textContent = page.label;
    return link;
  }

  function appendNavLink(navList, page) {
    const item = document.createElement('li');
    item.appendChild(createNavLink(page));
    navList.appendChild(item);
  }

  function appendNavDropdown(navList, entry, pagesById) {
    const onlinePages = (entry.pages || [])
      .map((pageId) => pagesById.get(pageId))
      .filter(isOnline);

    if (!onlinePages.length) {
      return;
    }

    const item = document.createElement('li');
    const button = document.createElement('button');
    const menu = document.createElement('ul');
    const chevron = document.createElement('span');

    item.className = 'nav-dropdown';
    button.type = 'button';
    button.className = 'nav-dropdown-btn';
    button.setAttribute('aria-expanded', 'false');
    button.append(document.createTextNode(entry.label || 'Menu'));
    chevron.className = 'nav-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▾';
    button.append(document.createTextNode(' '), chevron);
    menu.className = 'nav-dropdown-menu';

    onlinePages.forEach((page) => {
      const menuItem = document.createElement('li');
      menuItem.appendChild(createNavLink(page));
      menu.appendChild(menuItem);
    });

    item.append(button, menu);
    navList.appendChild(item);
  }

  function renderNavigation(registry) {
    const navList = document.getElementById('nav-list');
    if (!navList) {
      return registry;
    }

    const pagesById = buildPageMap(registry);
    navList.innerHTML = '';

    (registry.navigation || []).forEach((entry) => {
      if (entry.page) {
        const page = pagesById.get(entry.page);
        if (isOnline(page)) {
          appendNavLink(navList, page);
        }
        return;
      }

      appendNavDropdown(navList, entry, pagesById);
    });

    return registry;
  }

  function markActiveLink(page, registry) {
    const pagesById = buildPageMap(registry || FALLBACK_REGISTRY);
    const currentPage = pagesById.get(page);
    const pages = [
      page,
      document.body.dataset.pageParent,
      currentPage?.parent
    ].filter(Boolean);

    if (!pages.length) {
      return;
    }

    document.querySelectorAll('[data-nav-link]').forEach((link) => {
      if (pages.includes(link.dataset.navLink)) {
        link.classList.add('nav-active');
        link.setAttribute('aria-current', 'page');

        const dropdownButton = link.closest('.nav-dropdown')?.querySelector('.nav-dropdown-btn');
        if (dropdownButton) {
          dropdownButton.classList.add('nav-active');
        }
      }
    });
  }

  async function loadPageRegistry() {
    try {
      const response = await fetch(PAGE_REGISTRY_PATH);
      if (!response.ok) {
        throw new Error(`Page registry request failed with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('header.js: could not load page registry', error);
      return FALLBACK_REGISTRY;
    }
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

        const wasOpen = dropdown.classList.contains('open');
        document.querySelectorAll('.nav-dropdown.open').forEach((openDropdown) => {
          if (openDropdown === dropdown) {
            return;
          }

          openDropdown.classList.remove('open');

          const openDropdownButton = openDropdown.querySelector('.nav-dropdown-btn');
          if (openDropdownButton) {
            openDropdownButton.setAttribute('aria-expanded', 'false');
          }
        });

        const isOpen = wasOpen ? false : true;
        dropdown.classList.toggle('open', isOpen);
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

      const registry = await loadPageRegistry();
      headerPlaceholder.outerHTML = await response.text();
      renderNavigation(registry);
      applyTheme(getStoredTheme());
      bindHeaderControls();
      markActiveLink(document.body.dataset.page, registry);
    } catch (error) {
      console.warn('header.js: could not load header partial', error);
    }
  }

  applyTheme(getStoredTheme());
  document.addEventListener('DOMContentLoaded', injectHeader);
})();
