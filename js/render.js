import { renderBlocks } from './blocks.js';
import { escapeHtml } from './util.js';

const enabled = (model, name) => model.settings?.sections?.[name]?.enabled !== false;
const tagRow = (tags) => (tags && tags.length)
  ? `<ul class="tag-row">${tags.map(t=>`<li class="tag">${escapeHtml(t)}</li>`).join('')}</ul>` : '';

export function renderSummary(model) {
  if (!enabled(model, 'summary')) return '';
  return `<p class="summary-text">${escapeHtml(model.summary?.content || '')}</p>`;
}

export function renderExperience(model) {
  if (!enabled(model, 'experience')) return '';
  return (model.experience || []).map((e) => {
    const roles = (e.roles || []).map((r) => {
      const resps = (r.blocks || []).filter(b => b.type === 'responsibility');
      const other = (r.blocks || []).filter(b => b.type !== 'responsibility');
      const list = resps.length ? `<ul class="resp-list">${renderBlocks(resps)}</ul>` : '';
      return `<div class="role"><h4 class="role-title">${escapeHtml(r.title)}</h4>
        <p class="role-date">${escapeHtml(r.displayDate || '')}</p>${list}${renderBlocks(other)}</div>`;
    }).join('');
    return `<article class="exp" data-cluster="${escapeHtml(e.cluster || '')}">
      <header class="exp-head"><h3 class="exp-company">${escapeHtml(e.company)}</h3>
      <span class="exp-loc">${escapeHtml(e.location || '')}</span></header>
      ${tagRow(e.tags)}${roles}</article>`;
  }).join('');
}

export function renderProjects(model) {
  if (!enabled(model, 'projects')) return '';
  const statuses = model.settings?.statuses || {};
  return (model.projects || []).map((p, i) => {
    const st = statuses[p.status];
    const pill = st ? `<span class="status-pill" data-tone="${escapeHtml(st.tone)}">${escapeHtml(st.glyph)} ${escapeHtml(st.label)}</span>` : '';
    const links = Object.entries(p.links || {}).flatMap(([k, v]) => {
      if (k === 'extra' && Array.isArray(v)) return v.map(x => `<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.label)}</a>`);
      if (typeof v === 'string' && v) return [`<a href="${escapeHtml(v)}" target="_blank" rel="noopener">${escapeHtml(k)}</a>`];
      return [];
    }).join('');
    return `<article class="project" id="project-${i}" data-cluster="${escapeHtml(p.cluster || '')}">
      <header class="project-head"><h3 class="project-title">${escapeHtml(p.title)}</h3>${pill}</header>
      ${tagRow(p.tags)}<div class="project-body">${renderBlocks(p.blocks)}</div>
      <div class="project-links">${links}</div></article>`;
  }).join('');
}

export function renderSkills(model) {
  if (!enabled(model, 'skills')) return '';
  return (model.skills?.categories || []).map((c) => {
    if (c.type === 'languages') {
      const items = (c.items||[]).map(it => `<li class="lang"><span class="lang-name">${escapeHtml(it.name)}</span> <span class="lang-level">${escapeHtml(it.level||'')}</span></li>`).join('');
      return `<div class="skill-cat"><h3 class="skill-cat-name">${escapeHtml(c.name)}</h3><ul class="lang-list">${items}</ul></div>`;
    }
    const items = (c.items||[]).map(it => `<li class="tag">${escapeHtml(it.name)}</li>`).join('');
    return `<div class="skill-cat"><h3 class="skill-cat-name">${escapeHtml(c.name)}</h3><ul class="tag-row">${items}</ul></div>`;
  }).join('');
}

export function renderEducation(model) {
  if (!enabled(model, 'education')) return '';
  return (model.education || []).map((d) => `<article class="edu" data-cluster="${escapeHtml(d.cluster || '')}">
    <h3 class="edu-inst">${escapeHtml(d.institution)}</h3>
    <p class="edu-degree">${escapeHtml(d.degree)}</p>
    <p class="edu-meta">${escapeHtml(d.displayDate||'')} · ${escapeHtml(d.grade||'')}</p>
    ${renderBlocks(d.blocks)}</article>`).join('');
}

export function renderContact(model) {
  const c = model.profile?.contact || {};
  const cv = model.settings?.cv;
  const links = [];
  if (c.email) links.push(`<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>`);
  if (c.linkedin?.url) links.push(`<a href="${escapeHtml(c.linkedin.url)}" target="_blank" rel="noopener">${escapeHtml(c.linkedin.label||'LinkedIn')}</a>`);
  if (c.github?.url) links.push(`<a href="${escapeHtml(c.github.url)}" target="_blank" rel="noopener">${escapeHtml(c.github.label||'GitHub')}</a>`);
  if (cv?.path) links.push(`<a href="${escapeHtml(cv.path)}" download="${escapeHtml(cv.downloadName||'CV.pdf')}">Download CV</a>`);
  return `<p class="contact-meta">${escapeHtml(c.location||'')} · ${escapeHtml(c.phone||'')}</p>
    <div class="contact-links">${links.join('')}</div>`;
}

export function mountSections(model, root = document) {
  const map = { summary:renderSummary, experience:renderExperience, projects:renderProjects,
                skills:renderSkills, education:renderEducation, contact:renderContact };
  for (const [id, fn] of Object.entries(map)) {
    const el = root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
    if (el) el.innerHTML = fn(model);
  }
}
