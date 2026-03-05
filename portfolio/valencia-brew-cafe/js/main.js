/* ════════════════════════════════════════════════
   Valencia Brew Café — Main JavaScript
   ════════════════════════════════════════════════ */

/* ── Footer year ──────────────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── Announce bar height offset ───────────────── */
const announceBar = document.querySelector('.announce-bar');
const navbar      = document.getElementById('navbar');

function getAnnounceHeight() {
  return announceBar ? announceBar.offsetHeight : 0;
}

/* ── Navbar scroll state ──────────────────────── */
function updateNavbar() {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}
window.addEventListener('scroll', updateNavbar, { passive: true });
updateNavbar();

/* ── Mobile menu toggle ───────────────────────── */
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

navMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

/* ── Smooth scroll for anchor links ──────────────*/
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 12;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ── Active nav link on scroll ────────────────── */
const sections = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.navbar__nav a');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link =>
        link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id)
      );
    }
  });
}, { threshold: 0.35 });

sections.forEach(s => sectionObserver.observe(s));

/* ── Scroll Reveal ────────────────────────────── */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ── Menu tabs ────────────────────────────────── */
const menuTabs   = document.querySelectorAll('.menu__tab');
const menuPanels = document.querySelectorAll('.menu__panel');

menuTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    menuTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    menuPanels.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const panel = document.getElementById('tab-' + target);
    if (panel) panel.classList.add('active');
  });
});

/* ── Gallery lightbox ─────────────────────────── */
const galleryItems   = document.querySelectorAll('.gallery-item');
const lightbox       = document.getElementById('lightbox');
const lightboxClose  = document.getElementById('lightboxClose');
const lightboxContent = document.getElementById('lightboxContent');
const lightboxCaption = document.getElementById('lightboxCaption');

function openLightbox(item) {
  const placeholder = item.querySelector('.gallery-placeholder');
  const caption     = item.dataset.caption || '';

  lightboxContent.innerHTML = '';

  const clone = placeholder.cloneNode(true);
  clone.style.cssText = 'width:100%;aspect-ratio:16/10;border-radius:12px;';
  lightboxContent.appendChild(clone);
  lightboxCaption.textContent = caption;

  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

galleryItems.forEach(item => {
  item.addEventListener('click', () => openLightbox(item));
  item.setAttribute('tabindex', '0');
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(item);
    }
  });
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ── Reservation form ─────────────────────────── */
const reserveForm = document.getElementById('reserveForm');
if (reserveForm) {
  const dateInput = document.getElementById('res-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  reserveForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const name  = this.name.value.trim();
    const date  = this.date.value;
    const time  = this.time.value;
    const guests = this.guests.value;
    const note  = this.note.value.trim();

    if (!name || !date) {
      showFeedback('Please fill in your name and preferred date.', 'error');
      return;
    }

    const subject = encodeURIComponent(`Table Reservation — ${name} (${guests} guest${guests === '1' ? '' : 's'})`);
    const body    = encodeURIComponent(
      `Name: ${name}\nGuests: ${guests}\nDate: ${date}\nTime: ${time}\nNotes: ${note || 'None'}`
    );
    window.location.href = `mailto:hello@valenciabrew.ph?subject=${subject}&body=${body}`;

    showFeedback('Redirecting to your email app to send the reservation! We\'ll confirm within 2 hours.', 'success');
    this.reset();
  });
}

function showFeedback(text, type) {
  const existing = reserveForm.querySelector('.form__feedback');
  if (existing) existing.remove();

  const el = document.createElement('p');
  el.className = 'form__feedback';
  el.textContent = text;
  el.style.cssText = `
    font-size: 0.85rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    text-align: center;
    background: ${type === 'success' ? 'rgba(79,247,142,0.08)' : 'rgba(247,79,79,0.08)'};
    border: 1px solid ${type === 'success' ? 'rgba(79,247,142,0.3)' : 'rgba(247,79,79,0.3)'};
    color: ${type === 'success' ? '#7AFAB3' : '#F47A7A'};
  `;
  reserveForm.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

/* ── Marquee pause on hover ───────────────────── */
const marqueeTrack = document.querySelector('.marquee-track');
if (marqueeTrack) {
  marqueeTrack.addEventListener('mouseenter', () => {
    marqueeTrack.style.animationPlayState = 'paused';
  });
  marqueeTrack.addEventListener('mouseleave', () => {
    marqueeTrack.style.animationPlayState = 'running';
  });
}
