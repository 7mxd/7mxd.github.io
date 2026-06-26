import { deriveGraph } from './graph-model.js';
import { createSimulation } from './force.js';
import { clamp } from './util.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initGraph(model, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const clusters = model.settings.graph.clusters;
  const order = ['math','data','engineering'];
  const { nodes, edges } = deriveGraph(model);
  const byId = new Map(nodes.map(n => [n.id, n]));

  let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const centers = {};
  order.forEach((k, i) => { centers[k] = { x: W * (i + 1) / 4, y: H / 2 }; });
  // seed: scattered "noise"
  for (const n of nodes) {
    const c = centers[n.cluster] || { x: W/2, y: H/2 };
    n.x = c.x + (Math.random() - 0.5) * W * 0.6;
    n.y = c.y + (Math.random() - 0.5) * H * 0.6;
    n.vx = 0; n.vy = 0;
  }
  const sim = createSimulation(nodes, edges, {
    width: W, height: H, clusterCenters: centers,
    springLength: 50, repulsion: 1200, clusterGravity: 0.014
  });

  const radius = (n) => clamp(4 + n.weight * 1.4, 4, 16);
  const colorOf = (n) => n.cluster ? (clusters[n.cluster]?.color || '#888') : 'rgba(140,140,140,.6)';

  let hover = null;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(128,128,128,.35)'; ctx.lineWidth = 1;
    for (const e of edges) {
      const a = byId.get(e.source), b = byId.get(e.target); if (!a || !b) continue;
      const lit = hover && (a.id === hover.id || b.id === hover.id);
      ctx.globalAlpha = lit ? 0.9 : 0.25;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const n of nodes) {
      ctx.beginPath(); ctx.arc(n.x, n.y, radius(n), 0, Math.PI * 2);
      ctx.fillStyle = colorOf(n); ctx.globalAlpha = (!hover || hover === n) ? 1 : 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let raf = null, frozen = false;
  function loop() {
    const e = sim.step();
    draw();
    if (e < 0.05) { frozen = true; raf = null; return; }
    raf = requestAnimationFrame(loop);
  }
  function startLoop() { if (!frozen && raf == null) raf = requestAnimationFrame(loop); }
  function stopLoop() { if (raf != null) { cancelAnimationFrame(raf); raf = null; } }

  if (reduced()) { for (let i = 0; i < 300; i++) sim.step(); draw(); }
  else { startLoop(); }

  // pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop(); else if (!frozen) startLoop();
  });
  // pause when hero scrolled offscreen
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { if (!frozen) startLoop(); } else stopLoop();
  }, { threshold: 0 });
  io.observe(canvas);

  window.addEventListener('resize', () => { resize();
    order.forEach((k,i)=>{ centers[k]={x:W*(i+1)/4,y:H/2}; }); frozen=false; startLoop(); });

  // tooltip + interaction
  const tip = document.createElement('div'); tip.className = 'graph-tooltip';
  document.body.appendChild(tip);
  function nodeAt(px, py) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]; if (Math.hypot(n.x - px, n.y - py) <= radius(n) + 4) return n;
    }
    return null;
  }
  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    hover = nodeAt(ev.clientX - r.left, ev.clientY - r.top);
    if (hover) {
      tip.textContent = hover.label; tip.dataset.show = 'true';
      tip.style.left = `${ev.clientX + 12}px`; tip.style.top = `${ev.clientY + 12}px`;
      canvas.style.cursor = hover.ref ? 'pointer' : 'default';
      if (frozen) draw();
    } else { tip.dataset.show = 'false'; canvas.style.cursor = 'default'; if (frozen) draw(); }
  });
  canvas.addEventListener('mouseleave', () => { hover = null; tip.dataset.show = 'false'; if (frozen) draw(); });
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const n = nodeAt(ev.clientX - r.left, ev.clientY - r.top);
    if (n?.ref) {
      const el = document.getElementById(n.ref.section);
      el?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
    }
  });
}
