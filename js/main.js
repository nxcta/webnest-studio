/* ════════════════════════════════════════════════
   WebNest Studio — Main JavaScript
   ════════════════════════════════════════════════ */

/* ── Footer Year ──────────────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── Navbar: scroll state ─────────────────────── */
const navbar = document.getElementById('navbar');

function updateNavbar() {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', updateNavbar, { passive: true });
updateNavbar();

/* ── Navbar: mobile toggle ────────────────────── */
const navToggle = document.getElementById('navToggle');
const navMenu   = document.getElementById('navMenu');

navToggle.addEventListener('click', () => {
  const isOpen = navMenu.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

function closeMenu() {
  navMenu.classList.remove('open');
  navToggle.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

navMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', closeMenu);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMenu();
});

/* ── Scroll Reveal ────────────────────────────── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ── Smooth scroll for anchor links ──────────────
   (Polyfill for browsers that don't support CSS scroll-behavior) */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navHeight = navbar.offsetHeight;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight - 12;
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  });
});

/* ── Active nav link on scroll ────────────────── */
const sections = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.navbar__nav a');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === '#' + entry.target.id
          );
        });
      }
    });
  },
  { threshold: 0.4 }
);

sections.forEach(section => sectionObserver.observe(section));

/* ── Contact form: mailto fallback ───────────────
   Opens the user's email client pre-filled with
   the form data since this is a static site.      */
const contactForm = document.getElementById('contactForm');

if (contactForm) {
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const name     = this.name.value.trim();
    const email    = this.email.value.trim();
    const business = this.business.value.trim();
    const message  = this.message.value.trim();

    if (!name || !email || !message) {
      showFormFeedback('Please fill in your name, email, and message.', 'error');
      return;
    }

    const subject = encodeURIComponent(`Website Inquiry from ${name}${business ? ' — ' + business : ''}`);
    const body    = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nBusiness/Project: ${business || 'N/A'}\n\n${message}`
    );
    const mailto  = `mailto:webneststudiobkdn@gmail.com?subject=${subject}&body=${body}`;

    window.location.href = mailto;

    showFormFeedback('Opening your email app... We\'ll get back to you within 24 hours!', 'success');
    this.reset();
  });
}

function showFormFeedback(text, type) {
  const existing = contactForm.querySelector('.form__feedback');
  if (existing) existing.remove();

  const el = document.createElement('p');
  el.className = 'form__feedback';
  el.textContent = text;
  el.style.cssText = `
    font-size: 0.85rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    text-align: center;
    background: ${type === 'success' ? 'rgba(79,247,142,0.1)' : 'rgba(247,79,79,0.1)'};
    border: 1px solid ${type === 'success' ? 'rgba(79,247,142,0.3)' : 'rgba(247,79,79,0.3)'};
    color: ${type === 'success' ? '#4FF78E' : '#F74F4F'};
  `;
  contactForm.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
