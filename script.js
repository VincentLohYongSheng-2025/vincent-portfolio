/**
 * Vincent Loh Yong Sheng — Personal Portfolio
 * Editorial Script: Smooth navigation, copy email action, Malaysia local clock, reveal animations
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Live Malaysia Local Time Clock (MYT, UTC+8)
  const clockElement = document.getElementById('live-clock');
  function updateMalaysiaClock() {
    if (!clockElement) return;
    try {
      const now = new Date();
      // Format to Asia/Kuala_Lumpur
      const options = {
        timeZone: 'Asia/Kuala_Lumpur',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('en-GB', options);
      clockElement.textContent = `${formatter.format(now)} MYT`;
    } catch (e) {
      // Fallback
      const d = new Date();
      clockElement.textContent = d.toTimeString().split(' ')[0];
    }
  }
  updateMalaysiaClock();
  setInterval(updateMalaysiaClock, 1000);

  // 2. Email Copy with Feedback Toast
  const copyBtn = document.getElementById('copy-email-btn');
  const copyToast = document.getElementById('copy-toast');
  const copyBtnText = document.getElementById('copy-btn-text');
  const emailToCopy = 'vincentlohys@gmail.com';

  if (copyBtn && copyToast) {
    copyBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(emailToCopy);
        } else {
          // Fallback using textarea
          const textArea = document.createElement('textarea');
          textArea.value = emailToCopy;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }

        if (copyBtnText) copyBtnText.textContent = 'Copied!';
        copyToast.textContent = 'Address copied to clipboard.';

        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'Copy';
          copyToast.textContent = '';
        }, 2600);
      } catch (err) {
        copyToast.textContent = 'vincentlohys@gmail.com';
      }
    });
  }

  // 3. Mobile Navigation Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mainNav = document.getElementById('main-nav');
  const navLinks = document.querySelectorAll('.nav-link');

  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
      mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
      mainNav.classList.toggle('menu-open');
    });

    // Close menu when clicking a link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mainNav.classList.remove('menu-open');
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mainNav.classList.contains('menu-open')) {
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
        mainNav.classList.remove('menu-open');
        mobileMenuBtn.focus();
      }
    });
  }

  // 4. Subtle Scrollspy for Navigation Highlighting
  const sections = document.querySelectorAll('section[id]');
  function updateNavSpy() {
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');
      const targetNavLink = document.querySelector(`.main-nav a[href*="#${sectionId}"]`);

      if (targetNavLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          targetNavLink.classList.add('active');
        } else {
          targetNavLink.classList.remove('active');
        }
      }
    });
  }
  window.addEventListener('scroll', updateNavSpy, { passive: true });
  updateNavSpy();

  // 5. Subtle Reveal on Scroll (Respects prefers-reduced-motion)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const revealElements = document.querySelectorAll(
      '.project-entry, .timeline-row, .award-card, .edu-item, .contact-card'
    );

    revealElements.forEach(el => {
      el.classList.add('reveal-init');
    });

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.08
      }
    );

    revealElements.forEach(el => revealObserver.observe(el));
  }

  // 6. Lightweight pointer response for the original VL Power Core.
  // One rAF is scheduled per pointer move; no continuous animation loop is used.
  if (!prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    const core = document.querySelector('[data-power-core]');
    let framePending = false;
    let pointerX = 0;
    let pointerY = 0;

    if (core) {
      const setCoreTilt = () => {
        const rect = core.getBoundingClientRect();
        const x = (pointerX - rect.left) / rect.width - 0.5;
        const y = (pointerY - rect.top) / rect.height - 0.5;
        core.style.transform = `rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
        framePending = false;
      };

      core.addEventListener('pointermove', (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!framePending) {
          framePending = true;
          window.requestAnimationFrame(setCoreTilt);
        }
      });

      core.addEventListener('pointerleave', () => {
        core.style.transform = '';
      });
    }

    // Small magnetic pull for primary calls-to-action only.
    document.querySelectorAll('.hero-actions .btn').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        button.style.transform = `translate(${(x * 5).toFixed(1)}px, ${(y * 4).toFixed(1)}px)`;
      });
      button.addEventListener('pointerleave', () => { button.style.transform = ''; });
    });
  }
});
