/*
  script.js — vanilla JavaScript for small interactive features
  - theme toggle (stores preference in localStorage)
  - responsive nav toggle (mobile)
  - animated counters triggered by IntersectionObserver
  - simple demo form handler (client-side only)
*/

// Helper: query selector shorthand
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);


// THEME TOGGLE --------------------------------------------------------------
// Toggle between light and dark theme. We add/remove the `light-theme` class
// on the documentElement and persist the choice to localStorage so preference
// is preserved across visits.
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light-theme');
    $('#theme-toggle').textContent = '☀️';
    $('#theme-toggle').setAttribute('aria-pressed', 'true');
  } else {
    root.classList.remove('light-theme');
    $('#theme-toggle').textContent = '🌙';
    $('#theme-toggle').setAttribute('aria-pressed', 'false');
  }
  localStorage.setItem('site-theme', theme);
}

function toggleTheme() {
  const isLight = document.documentElement.classList.contains('light-theme');
  applyTheme(isLight ? 'dark' : 'light');
}

// Yelp logic removed

// INITIALIZATION -----------------------------------------------------------
function init() {
  // Apply saved theme or default to dark
  const saved = localStorage.getItem('site-theme') || 'dark';
  applyTheme(saved);

  // Theme toggle button
  $('#theme-toggle').addEventListener('click', toggleTheme);

  // Mobile nav toggle
  const navBtn = document.querySelector('.nav-toggle');
  if (navBtn) navBtn.addEventListener('click', toggleNav);

  // CTA smooth scroll removed for production

  // Counters and contact form removed for production

  // Yelp UI removed

  // Initialize map (if Leaflet is available). If Leaflet hasn't loaded yet
  // (rare), wait for the window `load` event and try again.
  if (typeof L !== 'undefined') {
    initMap();
  } else {
    window.addEventListener('load', () => { if (typeof L !== 'undefined') initMap(); });
  }
}

document.addEventListener('DOMContentLoaded', init);

// All Yelp-related logic has been removed

