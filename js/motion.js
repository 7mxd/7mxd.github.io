const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el) {
  const target = parseFloat(el.dataset.countup);
  if (!Number.isFinite(target)) return;
  const dur = 900; const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * t).toString();
    if (t < 1) requestAnimationFrame(tick); else el.textContent = el.dataset.countup;
  };
  requestAnimationFrame(tick);
}

function revealAscii(pre) {
  const full = pre.textContent; pre.textContent = '';
  let i = 0; const step = Math.max(1, Math.floor(full.length / 60));
  const tick = () => { i += step; pre.textContent = full.slice(0, i);
    if (i < full.length) requestAnimationFrame(tick); else pre.textContent = full; };
  requestAnimationFrame(tick);
}

export function initMotion() {
  const cards = document.querySelectorAll('.exp, .project, .edu, .skill-cat, .summary-text');
  if (reduced()) { cards.forEach(c => c.classList.add('in-view')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in-view');
      e.target.querySelectorAll?.('[data-countup]').forEach(countUp);
      e.target.querySelectorAll?.('[data-animate="ascii"]').forEach(revealAscii);
      io.unobserve(e.target);
    }
  }, { threshold: 0.2 });
  cards.forEach(c => io.observe(c));
}
