/** Portfolio navigation and accessible, event-driven interactions. */
document.addEventListener('DOMContentLoaded', () => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // Malaysia time is content, so it continues to work with or without WebGL.
  const clockElement = document.getElementById('live-clock');
  const timeFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  function updateClock() {
    if (clockElement) clockElement.textContent = `${timeFormat.format(new Date())} MYT`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  const copyButton = document.getElementById('copy-email-btn');
  const copyText = document.getElementById('copy-btn-text');
  const copyToast = document.getElementById('copy-toast');
  let copyReset;
  copyButton?.addEventListener('click', async () => {
    const address = 'vincentlohys@gmail.com';
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(address);
      else {
        const field = document.createElement('textarea');
        field.value = address;
        field.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Clipboard unavailable');
      }
      copyText.textContent = 'Copied!';
      copyToast.textContent = 'Address copied to clipboard.';
      clearTimeout(copyReset);
      copyReset = setTimeout(() => {
        copyText.textContent = 'Copy';
        copyToast.textContent = '';
      }, 2600);
    } catch (_) {
      copyToast.textContent = address;
    }
    copyButton.focus({ preventScroll: true });
  });

  const menuButton = document.getElementById('mobile-menu-btn');
  const navigation = document.getElementById('main-nav');
  const navLinks = [...document.querySelectorAll('.nav-link')];
  function closeMenu() {
    menuButton?.setAttribute('aria-expanded', 'false');
    navigation?.classList.remove('menu-open');
  }
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('menu-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation?.classList.contains('menu-open')) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener('focusin', event => {
    if (navigation?.classList.contains('menu-open') &&
        !navigation.contains(event.target) && event.target !== menuButton) closeMenu();
    event.target.closest('.depth-pending')?.classList.add('depth-visible');
  });
  matchMedia('(min-width: 769px)').addEventListener('change', closeMenu);

  // Anchor navigation should land promptly; enhanced focus follows the actual section.
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      closeMenu();
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      history.pushState(null, '', link.hash);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      needsMeasure = true;
      scheduleProgress();
    });
  });

  const header = document.querySelector('.site-header');
  const experienceTimeline = document.querySelector('.experience-timeline');
  const tracked = navLinks.map(link => ({ link, section: document.getElementById(link.hash.slice(1)), top: 0, bottom: 0 }))
    .filter(item => item.section);
  let scrollRange = 1;
  let needsMeasure = true;
  let progressFrame = 0;
  function updateProgress() {
    progressFrame = 0;
    if (needsMeasure) {
      tracked.forEach(item => {
        const rect = item.section.getBoundingClientRect();
        item.top = rect.top + scrollY - 120;
        item.bottom = item.top + rect.height;
      });
      scrollRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      needsMeasure = false;
    }
    const readingLine = scrollY + (header?.offsetHeight || 0) + 32;
    let active = tracked[0];
    tracked.forEach(item => {
      if (readingLine >= item.top) active = item;
    });
    tracked.forEach(item => {
      const selected = item === active;
      item.link.classList.toggle('active', selected);
      item.link.style.setProperty('--chapter-progress', clamp((scrollY - item.top) / (item.bottom - item.top), 0, 1).toFixed(4));
      if (selected) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
    header?.style.setProperty('--reading-progress', clamp(scrollY / scrollRange, 0, 1).toFixed(4));
    if (experienceTimeline) {
      const rect = experienceTimeline.getBoundingClientRect();
      const timelineProgress = clamp((innerHeight * .72 - rect.top) / Math.max(1, rect.height), .04, 1);
      experienceTimeline.style.setProperty('--timeline-progress', timelineProgress.toFixed(4));
    }
  }
  function scheduleProgress() {
    if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress);
  }
  addEventListener('scroll', scheduleProgress, { passive: true });
  addEventListener('resize', () => { needsMeasure = true; scheduleProgress(); }, { passive: true });
  document.fonts?.ready.then(() => { needsMeasure = true; scheduleProgress(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    needsMeasure = true;
    scheduleProgress();
  }).observe(document.body);
  scheduleProgress();

  // The content is always readable; the observer adds depth only to visible panels.
  const revealGroups = [
    [...document.querySelectorAll('.about-statement, .domain-item')],
    [...document.querySelectorAll('.project-entry')],
    [...document.querySelectorAll('.timeline-row')],
    [...document.querySelectorAll('.award-card')],
    [...document.querySelectorAll('.edu-item')],
    [...document.querySelectorAll('.contact-card')]
  ];
  revealGroups.forEach(group => group.forEach((item,index) => item.style.setProperty('--reveal-index',String(index))));
  const revealed = revealGroups.flat();
  const headings = [...document.querySelectorAll('.section-meta-header')];
  function setupReveals() {
    if (reduced.matches || !('IntersectionObserver' in window)) {
      document.body.classList.remove('depth-motion');
      revealed.forEach(item => item.classList.add('depth-visible'));
      headings.forEach(item => item.classList.add('section-entered'));
      return;
    }
    document.body.classList.add('depth-motion');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add(entry.target.classList.contains('section-meta-header') ? 'section-entered' : 'depth-visible');
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -5% 0px', threshold: .08 });
    revealed.forEach(item => {
      item.classList.add('depth-pending');
      observer.observe(item);
    });
    headings.forEach(item => observer.observe(item));
  }
  setupReveals();
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      document.body.classList.remove('depth-motion');
      revealed.forEach(item => item.classList.add('depth-visible'));
      headings.forEach(item => item.classList.add('section-entered'));
    }
  });

  // Fine pointer inputs update one frame at a time. Cards and buttons reset on exit.
  const pointerBindings = [];
  function bindPointer(element, kind) {
    let bounds;
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      bounds = null;
      element.style.removeProperty('--tilt-x');
      element.style.removeProperty('--tilt-y');
      element.style.removeProperty('--magnet-x');
      element.style.removeProperty('--magnet-y');
    };
    element.addEventListener('pointerenter', () => { bounds = element.getBoundingClientRect(); });
    element.addEventListener('pointermove', event => {
      if (!finePointer.matches || reduced.matches || event.pointerType !== 'mouse' || document.hidden) return;
      bounds ||= element.getBoundingClientRect();
      x = clamp((event.clientX - bounds.left) / bounds.width - .5, -.5, .5);
      y = clamp((event.clientY - bounds.top) / bounds.height - .5, -.5, .5);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (kind === 'card') {
          element.style.setProperty('--tilt-x', (x * 2.2).toFixed(2) + 'deg');
          element.style.setProperty('--tilt-y', (-y * 2.2).toFixed(2) + 'deg');
        } else {
          element.style.setProperty('--magnet-x', (x * 8).toFixed(2) + 'px');
          element.style.setProperty('--magnet-y', (y * 6).toFixed(2) + 'px');
        }
      });
    }, { passive: true });
    element.addEventListener('pointerleave', reset);
    element.addEventListener('pointercancel', reset);
    element.addEventListener('blur', reset);
    pointerBindings.push(reset);
  }
  const projectEntries = [...document.querySelectorAll('.project-entry')];
  projectEntries.forEach(item => bindPointer(item, 'card'));
  document.querySelectorAll('.hero-actions .btn, .copy-email-btn, .back-to-top')
    .forEach(item => bindPointer(item, 'button'));
  addEventListener('scroll', () => pointerBindings.forEach(reset => reset()), { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pointerBindings.forEach(reset => reset());
  });

  // Award stamps retain a tactile press response without turning the page into a particle effect.
  document.querySelectorAll('.achievement-stamp').forEach(stamp => {
    stamp.addEventListener('click', () => {
      stamp.classList.remove('stamp-pressed');
      void stamp.offsetWidth;
      stamp.classList.add('stamp-pressed');
      setTimeout(() => stamp.classList.remove('stamp-pressed'), 650);
    });
  });
});
