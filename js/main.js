/* ════════════════════════════════════════════════
   WebNest Studio — Main JavaScript
   ════════════════════════════════════════════════ */

/* ── Footer Year ──────────────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
document.body.classList.add('page-ready');

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

/* ── Client portal preview tabs ───────────────── */
const portalTabs = Array.from(document.querySelectorAll('.portal-tab'));
const portalPanels = Array.from(document.querySelectorAll('.portal-tab-panel'));

if (portalTabs.length && portalPanels.length) {
  portalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-portal-tab');
      if (!target) return;
      portalTabs.forEach(item => item.classList.toggle('is-active', item === tab));
      portalPanels.forEach(panel => {
        panel.classList.toggle('is-active', panel.getAttribute('data-portal-panel') === target);
      });
    });
  });
}

/* ── Premium micro-interactions ───────────────── */
const interactiveCards = Array.from(document.querySelectorAll('.interactive-card'));
const magneticButtons = Array.from(document.querySelectorAll('.btn'));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  interactiveCards.forEach(card => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-dy * 4).toFixed(2)}deg) rotateY(${(dx * 5).toFixed(2)}deg) translateY(-2px)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });

  magneticButtons.forEach(btn => {
    btn.addEventListener('pointermove', (e) => {
      const rect = btn.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      btn.style.transform = `translate(${(dx * 8).toFixed(1)}px, ${(dy * 6).toFixed(1)}px)`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
    });
  });
}

/* ── Lightweight 3D hero canvas ──────────────── */
const heroCanvas = document.getElementById('heroWebgl');
if (heroCanvas && !prefersReducedMotion) {
  const ctx = heroCanvas.getContext('2d');
  if (ctx) {
    const points = [];
    const pointCount = 56;
    let width = 0;
    let height = 0;
    let raf = null;
    let t = 0;

    for (let i = 0; i < pointCount; i += 1) {
      points.push({
        theta: (Math.PI * 2 * i) / pointCount,
        radius: 0.35 + Math.random() * 0.32,
        z: -0.9 + Math.random() * 1.8,
        speed: 0.25 + Math.random() * 0.45,
      });
    }

    function resizeHeroCanvas() {
      const dpr = window.devicePixelRatio || 1;
      width = heroCanvas.clientWidth || window.innerWidth;
      height = heroCanvas.clientHeight || Math.max(420, window.innerHeight * 0.7);
      heroCanvas.width = Math.round(width * dpr);
      heroCanvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(x, y, z, fov) {
      const scale = fov / (fov + z);
      return {
        x: x * scale + width * 0.68,
        y: y * scale + height * 0.5,
        scale,
      };
    }

    function draw() {
      t += 0.014;
      ctx.clearRect(0, 0, width, height);

      const projected = points.map((p, idx) => {
        const angle = p.theta + t * p.speed;
        const x = Math.cos(angle * 1.3 + Math.sin(t + idx * 0.06)) * (width * 0.2 * p.radius);
        const y = Math.sin(angle * 1.05) * (height * 0.22 * p.radius) + Math.sin(t * 0.8 + idx) * 6;
        const z = p.z * 120 + Math.cos(t + idx * 0.12) * 22;
        return project(x, y, z, 420);
      });

      for (let i = 0; i < projected.length; i += 1) {
        for (let j = i + 1; j < projected.length; j += 1) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 115) {
            const alpha = (1 - dist / 115) * 0.22;
            ctx.strokeStyle = `rgba(123, 179, 255, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      projected.forEach((p) => {
        const size = Math.max(1.2, p.scale * 2.6);
        ctx.fillStyle = 'rgba(123, 179, 255, 0.55)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = window.requestAnimationFrame(draw);
    }

    resizeHeroCanvas();
    draw();

    window.addEventListener('resize', resizeHeroCanvas, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = null;
      } else if (!document.hidden && !raf) {
        draw();
      }
    });
  }
}

/* ── Contact form: mailto fallback ───────────────
   Opens the user's email client pre-filled with
   the form data since this is a static site.      */
const contactForm = document.getElementById('contactForm');
let captchaToken = '';

async function refreshCaptchaChallenge() {
  const questionEl = document.getElementById('captchaQuestion');
  const answerEl = document.getElementById('captchaAnswer');
  if (!questionEl || !answerEl) return;

  questionEl.textContent = 'Loading challenge...';
  answerEl.value = '';
  captchaToken = '';

  try {
    const res = await fetch('/api/security/captcha', { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token || !data?.question) {
      questionEl.textContent = 'Unable to load challenge. Please refresh.';
      return;
    }
    captchaToken = String(data.token);
    questionEl.textContent = `Solve: ${data.question}`;
  } catch {
    questionEl.textContent = 'Unable to load challenge. Please refresh.';
  }
}

if (contactForm) {
  const startedAtEl = document.getElementById('formStartedAt');
  const trapEl = document.getElementById('websiteTrap');
  const captchaAnswerEl = document.getElementById('captchaAnswer');
  const captchaRefreshBtn = document.getElementById('captchaRefresh');
  if (startedAtEl) startedAtEl.value = String(Date.now());
  if (captchaRefreshBtn) captchaRefreshBtn.addEventListener('click', () => refreshCaptchaChallenge());
  refreshCaptchaChallenge();

  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const name     = this.name.value.trim();
    const email    = this.email.value.trim();
    const business = this.business.value.trim();
    const message  = this.message.value.trim();
    const trapValue = trapEl ? trapEl.value.trim() : '';
    const startedAt = Number(startedAtEl ? startedAtEl.value : 0);
    const formAgeMs = Date.now() - (Number.isFinite(startedAt) ? startedAt : 0);
    const captchaAnswer = captchaAnswerEl ? captchaAnswerEl.value.trim() : '';

    if (!name || !email || !message) {
      showFormFeedback('Please fill in your name, email, and message.', 'error');
      return;
    }
    if (trapValue) {
      showFormFeedback('Security check failed. Please refresh and try again.', 'error');
      return;
    }
    if (!startedAt || formAgeMs < 3500) {
      showFormFeedback('Please take a moment to complete the form, then try again.', 'error');
      return;
    }
    if (!captchaToken || !captchaAnswer) {
      showFormFeedback('Please complete the security challenge before sending.', 'error');
      return;
    }

    fetch('/api/security/captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: captchaToken, answer: captchaAnswer }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showFormFeedback((data && data.error) ? data.error : 'Security check failed. Please try again.', 'error');
          refreshCaptchaChallenge();
          return;
        }

        const subject = encodeURIComponent(`Website Inquiry from ${name}${business ? ' — ' + business : ''}`);
        const body    = encodeURIComponent(
          `Name: ${name}\nEmail: ${email}\nBusiness/Project: ${business || 'N/A'}\n\n${message}`
        );
        const mailto  = `mailto:webneststudiobkdn@gmail.com?subject=${subject}&body=${body}`;

        window.location.href = mailto;
        showFormFeedback('Security check passed. Opening your email app now.', 'success');
        this.reset();
        if (startedAtEl) startedAtEl.value = String(Date.now());
        refreshCaptchaChallenge();
      })
      .catch(() => {
        showFormFeedback('Unable to verify the security challenge right now. Please try again.', 'error');
      });
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

/* ── AI Chatbot (Portfolio Site Guide) ─────────── */
(function initChatbot() {
  const fab = document.getElementById('chatbotFab');
  const panel = document.getElementById('chatbotPanel');
  const closeBtn = document.getElementById('chatbotClose');
  const messagesEl = document.getElementById('chatbotMessages');
  const chipsEl = document.getElementById('chatbotChips');
  const form = document.getElementById('chatbotForm');
  const input = document.getElementById('chatbotInput');
  const sendBtn = document.getElementById('chatbotSend');

  if (!fab || !panel || !closeBtn || !messagesEl || !chipsEl || !form || !input || !sendBtn) return;

  let isOpen = false;
  let isBusy = false;
  let hasWelcomed = false;

  const suggested = [
    'What services do you offer?',
    'How much does a website cost?',
    'How long does it take to build a website?',
    'How can I contact you?',
  ];

  function renderChips() {
    chipsEl.innerHTML = '';
    suggested.forEach(text => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chatbot__chip';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        input.value = text;
        input.focus();
      });
      chipsEl.appendChild(btn);
    });
  }

  function appendMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = 'chatbot__msg ' + (role === 'user' ? 'chatbot__msg--user' : 'chatbot__msg--bot');
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function setOpen(next) {
    isOpen = next;
    fab.setAttribute('aria-expanded', String(isOpen));
    panel.hidden = !isOpen;
    if (isOpen) {
      renderChips();
      if (!hasWelcomed) {
        hasWelcomed = true;
        appendMessage('bot', 'Hi! I’m the WebNest site guide. Ask me about services, pricing, timelines, or how to contact me.');
      }
      setTimeout(() => input.focus(), 0);
    }
  }

  function setBusy(next) {
    isBusy = next;
    input.disabled = isBusy;
    sendBtn.disabled = isBusy;
  }

  async function sendMessage(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || isBusy) return;

    appendMessage('user', trimmed);
    input.value = '';
    setBusy(true);

    const typing = appendMessage('bot', 'Thinking…');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          res.status === 429 ? 'Too many messages too fast. Please wait a bit and try again.' :
          (data && data.error) ? data.error :
          'Something went wrong. Please try again in a moment.';
        typing.textContent = msg;
        return;
      }

      typing.textContent = (data && data.reply) ? data.reply : 'Sorry—no response was returned.';
    } catch (err) {
      typing.textContent = 'Network error. Please check your connection and try again.';
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  fab.addEventListener('click', () => setOpen(!isOpen));
  closeBtn.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') setOpen(false);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });
})();
