/* ════════════════════════════════════════════════
   Bukidnon Highlands Resort — Main JavaScript
   ════════════════════════════════════════════════ */

/* ── Footer year ──────────────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── Navbar scroll state ──────────────────────── */
const navbar = document.getElementById('navbar');

function updateNavbar() {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
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

/* ── Smooth scroll for anchors ────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = navbar.offsetHeight + 12;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  });
});

/* ── Active nav on scroll ─────────────────────── */
const sections = document.querySelectorAll('section[id], footer[id]');
const allNavLinks = document.querySelectorAll('.navbar__nav a, .navbar__nav--drawer a');

const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      allNavLinks.forEach(link =>
        link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id)
      );
    }
  });
}, { threshold: 0.3 });

sections.forEach(s => sectionObs.observe(s));

/* ── Scroll Reveal ────────────────────────────── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── Gallery Lightbox ─────────────────────────── */
const mosaicItems    = document.querySelectorAll('.mosaic-item');
const lightbox       = document.getElementById('lightbox');
const lightboxClose  = document.getElementById('lightboxClose');
const lightboxContent = document.getElementById('lightboxContent');
const lightboxCaption = document.getElementById('lightboxCaption');

function openLightbox(item) {
  const placeholder = item.querySelector('.mosaic-placeholder');
  const caption = item.dataset.caption || '';

  lightboxContent.innerHTML = '';
  if (placeholder) {
    const clone = placeholder.cloneNode(true);
    clone.style.cssText = 'width:100%;aspect-ratio:16/10;border-radius:12px;';
    lightboxContent.appendChild(clone);
  }
  lightboxCaption.textContent = caption;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

mosaicItems.forEach(item => {
  item.setAttribute('tabindex', '0');
  item.setAttribute('role', 'button');
  item.addEventListener('click', () => openLightbox(item));
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(item); }
  });
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ── FAQ Accordion ────────────────────────────── */
document.querySelectorAll('.faq-item__q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    document.querySelectorAll('.faq-item.open').forEach(openItem => {
      openItem.classList.remove('open');
      openItem.setAttribute('data-open', 'false');
    });

    if (!isOpen) {
      item.classList.add('open');
      item.setAttribute('data-open', 'true');
    }
  });
});

/* ── Booking form: date constraints ──────────────*/
const checkinInput  = document.getElementById('b-checkin');
const checkoutInput = document.getElementById('b-checkout');

if (checkinInput && checkoutInput) {
  const today = new Date().toISOString().split('T')[0];
  checkinInput.setAttribute('min', today);

  checkinInput.addEventListener('change', () => {
    checkoutInput.setAttribute('min', checkinInput.value);
    if (checkoutInput.value && checkoutInput.value <= checkinInput.value) {
      checkoutInput.value = '';
    }
  });
}

/* ── Booking form: mailto fallback ───────────────*/
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const name     = this.name.value.trim();
    const email    = this.email.value.trim();
    const phone    = this.phone.value.trim();
    const room     = this.room.value;
    const checkin  = this.checkin.value;
    const checkout = this.checkout.value;
    const adults   = this.adults.value;
    const children = this.children.value;
    const special  = this.special.value.trim();

    if (!name || !email || !checkin || !checkout) {
      showFeedback('Please fill in your name, email, and travel dates.', 'error');
      return;
    }

    const nights = Math.max(1, Math.round((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24)));
    const subject = encodeURIComponent(`Booking Inquiry — ${name} (${checkin} · ${nights} night${nights === 1 ? '' : 's'})`);
    const body    = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nRoom Type: ${room || 'Not specified'}\nCheck-in: ${checkin}\nCheck-out: ${checkout} (${nights} night${nights === 1 ? '' : 's'})\nAdults: ${adults}\nChildren: ${children}\n\nSpecial Requests:\n${special || 'None'}`
    );

    window.location.href = `mailto:reservations@bukidnonhighlands.ph?subject=${subject}&body=${body}`;
    showFeedback('Opening your email app to send the inquiry. We\'ll respond within 24 hours!', 'success');
    this.reset();
  });
}

function showFeedback(text, type) {
  const existing = bookingForm.querySelector('.form__feedback');
  if (existing) existing.remove();
  const el = document.createElement('p');
  el.className = 'form__feedback';
  el.textContent = text;
  el.style.cssText = `
    font-size:0.83rem;padding:0.75rem 1rem;border-radius:8px;text-align:center;
    background:${type === 'success' ? 'rgba(61,139,84,0.1)' : 'rgba(200,70,70,0.1)'};
    border:1px solid ${type === 'success' ? 'rgba(61,139,84,0.35)' : 'rgba(200,70,70,0.35)'};
    color:${type === 'success' ? '#5EC47A' : '#E07070'};
  `;
  bookingForm.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

/* ── Rooms scroll indicator ───────────────────── */
const roomsTrack = document.getElementById('roomsTrack');
if (roomsTrack) {
  roomsTrack.addEventListener('scroll', () => {
    const hint = document.querySelector('.rooms__scroll-hint');
    if (hint && roomsTrack.scrollLeft > 40) {
      hint.style.opacity = '0';
    } else if (hint) {
      hint.style.opacity = '1';
    }
  }, { passive: true });
}
