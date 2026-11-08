/* =========================================
   Vantelyo — Main Script
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle
  const btn = document.querySelector('.mobile-menu-btn');
  const links = document.querySelector('.nav-links');
  if (btn && links) {
    btn.addEventListener('click', () => {
      links.classList.toggle('active');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
    });
  }

  // Initialize i18n (restores the saved language)
  if (typeof initI18n === 'function') {
    initI18n();
  }

  // Smooth scroll for same-page anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Close mobile menu when clicking a link
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      const navLinks = document.querySelector('.nav-links');
      if (navLinks) navLinks.classList.remove('active');
    });
  });
});

// Graceful image fallback: never show a broken-image icon.
(function () {
  const placeholder =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">' +
        '<rect width="900" height="600" fill="#E8EDE4"/>' +
        '<g fill="none" stroke="#2D5A27" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">' +
          '<rect x="330" y="210" width="240" height="180" rx="14"/>' +
          '<circle cx="395" cy="270" r="22"/>' +
          '<path d="M350 380l70-70 55 55 35-35 60 50"/>' +
        '</g>' +
      '</svg>'
    );

  document.addEventListener(
    'error',
    function (event) {
      const el = event.target;
      if (!el || el.tagName !== 'IMG') return;
      if (el.getAttribute('data-fallback-applied') === '1') return;
      el.setAttribute('data-fallback-applied', '1');
      el.src = placeholder;
    },
    true
  );
})();
