/**
 * app.js
 * Theme switching, scroll effects, card entrance animations,
 * smooth scrolling, and contact form handling.
 */

(function () {
  'use strict';

  const html = document.documentElement;
  const canvas = document.getElementById('bg-canvas');
  const themeBtn = document.getElementById('theme-toggle');
  const nav = document.getElementById('nav');

  let isDark = false;

  // ── Theme ─────────────────────────────────────────────────────────────────
  function applyTheme(dark, animate) {
    isDark = dark;

    if (animate) {
      // Brief crossfade on canvas
      canvas.style.opacity = '0';
    }

    html.setAttribute('data-theme', dark ? 'dark' : 'light');

    if (dark) {
      LightCanvas.stop();
      DarkCanvas.init(canvas);
      DarkCanvas.start();
    } else {
      DarkCanvas.stop();
      LightCanvas.start();
    }

    if (animate) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          canvas.style.opacity = '1';
        });
      });
    }

    try {
      localStorage.setItem('sjs-theme', dark ? 'dark' : 'light');
    } catch (_) {}
  }

  // Restore saved preference
  let saved = null;
  try { saved = localStorage.getItem('sjs-theme'); } catch (_) {}
  if (saved === 'dark') {
    applyTheme(true, false);
  } else {
    // Initialise light canvas
    LightCanvas.init(canvas);
    LightCanvas.start();
  }

  themeBtn.addEventListener('click', () => applyTheme(!isDark, true));

  // ── Nav scroll state ──────────────────────────────────────────────────────
  function onScroll() {
    nav.classList.toggle('nav--scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Card entrance (IntersectionObserver) ──────────────────────────────────
  const cards = document.querySelectorAll('.card');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = parseInt(entry.target.dataset.delay || '0', 10);
            setTimeout(() => {
              entry.target.classList.add('card--visible');
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    cards.forEach((c) => observer.observe(c));
  } else {
    // Fallback: show all immediately
    cards.forEach((c) => c.classList.add('card--visible'));
  }

  // ── Smooth scroll for anchor links ────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = nav.offsetHeight + 12;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ── Contact form (static — wire to Formspree/Netlify as needed) ───────────
  const form = document.getElementById('contact-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    const original = btn.textContent;

    // Basic validation
    const name = form.querySelector('#name').value.trim();
    const email = form.querySelector('#email').value.trim();
    if (!name || !email) {
      shakeField(!name ? '#name' : '#email');
      return;
    }

    // Simulate send (replace with real endpoint)
    btn.textContent = 'Sending…';
    btn.disabled = true;

    setTimeout(() => {
      btn.textContent = 'Message sent ✓';
      btn.style.background = isDark ? 'transparent' : '#22c55e';
      btn.style.borderColor = '#22c55e';
      btn.style.color = isDark ? '#22c55e' : '#fff';
      if (isDark) btn.style.boxShadow = '0 0 20px rgba(34,197,94,0.4)';
      form.reset();

      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
        btn.style.cssText = '';
      }, 4000);
    }, 900);
  });

  function shakeField(selector) {
    const el = form.querySelector(selector);
    if (!el) return;
    el.style.animation = 'none';
    el.style.borderColor = '#ef4444';
    el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
    setTimeout(() => {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }, 2000);
    el.focus();
  }
})();
