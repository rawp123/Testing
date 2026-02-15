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

// NAVIGATION TOGGLE (MOBILE) -----------------------------------------------
function toggleNav() {
  const list = $('#nav-list');
  const btn = document.querySelector('.nav-toggle');
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  list.classList.toggle('show');
}

// ANIMATED COUNTERS ---------------------------------------------------------
// Use IntersectionObserver to trigger counter animation when visible.
function animateCounter(el, target) {
  // Simple incremental counter — good for small numbers.
  let start = 0;
  const duration = 900; // ms
  const stepTime = Math.max(Math.floor(duration / target), 8);
  const timer = setInterval(() => {
    start += 1;
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, stepTime);
}

function setupCounters() {
  const counters = $$('.counter');
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'), 10) || 0;
        if (!el.classList.contains('started')) {
          el.classList.add('started');
          animateCounter(el, target);
        }
        obs.unobserve(el);
      }
    });
  }, {threshold: 0.6});

  counters.forEach(c => io.observe(c));
}

// FORM HANDLER (demo-only) -------------------------------------------------
function setupForm() {
  const form = $('#contact-form');
  const status = $('#form-status');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    // Demo behaviour: show captured inputs and reset after 2s
    status.textContent = `Captured (demo): ${data.get('name') || '—'} — "${(data.get('message')||'').slice(0,60)}"`;
    status.style.color = 'var(--accent)';
    setTimeout(() => { status.textContent = ''; form.reset(); }, 2000);
  });
}

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

  // CTA smooth scroll
  $('#cta-demo').addEventListener('click', () => {
    document.querySelector('#contact').scrollIntoView({behavior:'smooth'});
  });

  // Counters and form
  setupCounters();
  setupForm();
}

document.addEventListener('DOMContentLoaded', init);
