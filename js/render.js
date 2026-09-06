import { escapeHtml, renderBlocks, imageMarkup, srcsetAttr } from './blocks.js';

/** How wide a gallery image actually renders, per context and per slot.
 *
 *  These are measured, not guessed. A single `sizes` constant of 46rem was
 *  wrong for every gallery on the page: `main` is 46rem wide but border-box,
 *  so its gutters eat into that, and a timeline entry loses a further 4.5rem
 *  year column plus its gap. Measured in headless Chrome at 390, 768 and 1280:
 *
 *    entry, one column       547px at 1280, 578px at 768   -> 37rem covers it
 *    entry, half of a pair   268px at 1280, 283px at 768   -> 18rem
 *    Selected Work column    193px (the height cap binds, see below)
 *
 *  `capPx` is the CSS max-height on the image. For a portrait photograph that
 *  cap binds before the slot width does, which pins the rendered width to a
 *  fixed number — no media query needed, and no viewport at which it is wrong.
 *  css/sections.css caps .gallery.is-single at 30rem and .work .gallery at
 *  26rem; a slot with no cap carries 0. */
const GALLERY_SLOTS = {
  entry: {
    single: { sizes: '(min-width: 40rem) 37rem, calc(100vw - 2.5rem)', maxPx: 592, capPx: 480 },
    full:   { sizes: '(min-width: 40rem) 37rem, calc(100vw - 2.5rem)', maxPx: 592, capPx: 0 },
    column: { sizes: '(min-width: 40rem) 18rem, calc(100vw - 2.5rem)', maxPx: 288, capPx: 0 },
  },
  work: {
    single: { sizes: '(min-width: 40rem) 42rem, calc(100vw - 2.5rem)', maxPx: 674, capPx: 416 },
    full:   { sizes: '(min-width: 40rem) 13rem, 45vw', maxPx: 208, capPx: 416 },
    column: { sizes: '(min-width: 40rem) 13rem, 45vw', maxPx: 208, capPx: 416 },
  },
};

/** The hero portrait is 11rem wide, 8rem below the 40rem breakpoint. */
const PORTRAIT_SIZES = '(max-width: 40rem) 8rem, 11rem';

function heading(id, text) {
  return `<h2 class="section-heading" id="${id}-heading">${escapeHtml(text)}</h2>`;
}

/** In a timeline gallery an odd trailing image spans both columns rather than
 *  sitting alone in one (`:last-child:nth-child(odd)` in css/sections.css). A
 *  Selected Work gallery overrides that back to a single column. */
function slotFor(context, index, count) {
  const slots = GALLERY_SLOTS[context];
  if (count === 1) return slots.single;
  const spans = context === 'entry' && count % 2 === 1 && index === count - 1;
  return spans ? slots.full : slots.column;
}

/** Where a max-height cap binds, the rendered width is a fixed number derived
 *  from the photograph's own aspect ratio, so say that instead of a viewport
 *  expression the browser would have to over-read. */
export function sizesFor(slot, image) {
  const aspect = image.width && image.height ? image.width / image.height : 0;
  if (slot.capPx && aspect) {
    const capped = Math.round(slot.capPx * aspect);
    if (capped < slot.maxPx) return `${capped}px`;
  }
  return slot.sizes;
}

/** One to three images. A lone trailing image spans the measure rather than
 *  sitting in a half column. */
function gallery(images, context) {
  if (!images || images.length === 0) return '';
  const modifier = images.length === 1 ? 'is-single' : 'is-grid';
  const figures = images
    .map((img, i) => imageMarkup(img, sizesFor(slotFor(context, i, images.length), img)))
    .join('');
  return `<div class="gallery ${modifier}" data-count="${images.length}">${figures}</div>`;
}

function renderHero(doc, profile) {
  const links = [
    `<a href="mailto:${escapeHtml(profile.contact.email)}">${escapeHtml(profile.contact.email)}</a>`,
    profile.contact.linkedin ? `<a href="${escapeHtml(profile.contact.linkedin.url)}">${escapeHtml(profile.contact.linkedin.label)}</a>` : '',
    profile.contact.github ? `<a href="${escapeHtml(profile.contact.github.url)}">${escapeHtml(profile.contact.github.label)}</a>` : '',
  ].filter(Boolean).join('');

  // index.html preloads this image and must offer the browser the identical
  // candidate list, or it downloads one file for the preload and a different
  // one for the <img>. test/render.test.js pins the two together.
  const portraitCandidates = profile.portrait ? srcsetAttr(profile.portrait) : '';
  const portraitSrcset = portraitCandidates
    ? ` srcset="${portraitCandidates}" sizes="${PORTRAIT_SIZES}"`
    : '';
  const portrait = profile.portrait
    ? `<img class="hero-portrait" src="${escapeHtml(profile.portrait.src)}"${portraitSrcset} alt="${escapeHtml(profile.portrait.alt)}" width="${Number(profile.portrait.width) || 0}" height="${Number(profile.portrait.height) || 0}" fetchpriority="high" decoding="async">`
    : '';

  doc.getElementById('hero').innerHTML = `
${portrait}
<div class="hero-text">
  <h1 class="hero-name">${escapeHtml(profile.name)}</h1>
  <p class="hero-name-ar" lang="ar" dir="rtl">${escapeHtml(profile.nameArabic)}</p>
  <p class="hero-role">${escapeHtml(profile.role)}</p>
  <p class="hero-tagline">${escapeHtml(profile.tagline)}</p>
  <p class="hero-links">${links}</p>
</div>`;
}

function renderAbout(doc, summary) {
  doc.getElementById('about').innerHTML =
    `${heading('about', 'About')}<p class="prose">${escapeHtml(summary.content)}</p>`;
}

function entryMarkup(entry) {
  const bullets = entry.bullets.length
    ? `<ul class="entry-bullets">${entry.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    : '';
  const note = entry.note ? `<p class="entry-note">${escapeHtml(entry.note)}</p>` : '';
  const org = entry.org ? `<span class="entry-org">${escapeHtml(entry.org)}</span>` : '';
  const dates = entry.dateRange ? `<span class="entry-dates">${escapeHtml(entry.dateRange)}</span>` : '';
  let more = '';
  if (entry.workRef) {
    more = `<p class="entry-more"><a href="#work-${escapeHtml(entry.workRef)}">Read more about this work</a></p>`;
  } else if (entry.link) {
    more = `<p class="entry-more"><a href="${escapeHtml(entry.link.url)}" rel="noopener">${escapeHtml(entry.link.label)}</a></p>`;
  }

  return `<li class="entry is-${escapeHtml(entry.kind)}">
<h3 class="entry-title">${escapeHtml(entry.title)}</h3>
<p class="entry-meta">${org}${dates}</p>
${note}${renderBlocks(entry.blocks)}${bullets}${more}${gallery(entry.images, 'entry')}
</li>`;
}

function renderPath(doc, timeline) {
  const groups = timeline.map((group) => `
<section class="year-group" aria-labelledby="year-${group.year}">
  <h3 class="year-label" id="year-${group.year}">${group.year}</h3>
  <ol class="entries">${group.entries.map(entryMarkup).join('')}</ol>
</section>`).join('');

  const span = timeline.length
    ? `<p class="section-note">${timeline[0].year} to ${timeline[timeline.length - 1].year}</p>`
    : '';

  doc.getElementById('path').innerHTML = `${heading('path', 'The path so far')}${span}${groups}`;
}

function renderNumbers(doc, metrics) {
  const items = metrics.items.map((m) => `
<div class="metric">
  <p class="metric-value">${escapeHtml(m.value)}</p>
  <p class="metric-label">${escapeHtml(m.label)}</p>
</div>`).join('');
  doc.getElementById('numbers').innerHTML = `${heading('numbers', 'By the numbers')}<div class="metrics">${items}</div>`;
}

function workMarkup(project) {
  const tags = project.tags?.length
    ? `<p class="work-tags">${project.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</p>`
    : '';

  const named = { ios: 'App Store', webapp: 'Website', github: 'GitHub' };
  const links = [];
  for (const [key, label] of Object.entries(named)) {
    if (project.links?.[key]) links.push(`<a href="${escapeHtml(project.links[key])}">${label}</a>`);
  }
  for (const extra of project.links?.extra ?? []) {
    links.push(`<a href="${escapeHtml(extra.url)}">${escapeHtml(extra.label)}</a>`);
  }
  const linkRow = links.length ? `<p class="work-links">${links.join('')}</p>` : '';

  const org = project.org ? `<span class="work-org">${escapeHtml(project.org)}</span>` : '';
  const dates = project.displayDate ? `<span class="work-dates">${escapeHtml(project.displayDate)}</span>` : '';

  return `<article class="work" id="work-${escapeHtml(project.id)}">
<h3 class="work-title">${escapeHtml(project.title)}</h3>
<p class="work-meta">${org}${dates}</p>
${renderBlocks(project.blocks)}
${gallery(project.images, 'work')}
${tags}${linkRow}
</article>`;
}

function renderWork(doc, projects) {
  doc.getElementById('work').innerHTML =
    `${heading('work', 'Selected work')}${projects.items.map(workMarkup).join('')}`;
}

function renderSkills(doc, skills) {
  const groups = skills.categories.map((cat) => {
    const items = cat.type === 'languages'
      ? cat.items.map((i) => `<li>${escapeHtml(i.name)} <span class="skill-level">${escapeHtml(i.level)}</span></li>`).join('')
      : cat.items.map((i) => `<li>${escapeHtml(i.name)}</li>`).join('');
    return `<div class="skill-group">
<h3 class="skill-group-name">${escapeHtml(cat.name)}</h3>
<ul class="skill-list">${items}</ul>
</div>`;
  }).join('');
  doc.getElementById('skills').innerHTML = `${heading('skills', 'Skills')}<div class="skill-groups">${groups}</div>`;
}

/** A URL shown as visible contact text reads better without its scheme or
 *  trailing slash. Derived from the link itself, so it can never drift out
 *  of sync with `profile.contact` the way a hand-typed copy of it could. */
function displayUrl(url) {
  return String(url ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
}

function renderContact(doc, profile) {
  const rows = [
    ['Email', `mailto:${profile.contact.email}`, profile.contact.email],
    profile.contact.linkedin
      ? [profile.contact.linkedin.label, profile.contact.linkedin.url, displayUrl(profile.contact.linkedin.url)]
      : null,
    profile.contact.github
      ? [profile.contact.github.label, profile.contact.github.url, displayUrl(profile.contact.github.url)]
      : null,
  ].filter(Boolean).map(([label, href, text]) => `
<div class="contact-row">
  <span class="contact-label">${escapeHtml(label)}</span>
  <a href="${escapeHtml(href)}">${escapeHtml(text)}</a>
</div>`).join('');

  doc.getElementById('contact').innerHTML =
    `${heading('contact', 'Contact')}<p class="prose">${escapeHtml(profile.location)}</p><div class="contacts">${rows}</div>`;
}

function renderChrome(doc, data) {
  const nameEl = doc.querySelector('[data-nav-name]');
  if (nameEl) nameEl.textContent = data.profile.name;

  const footerNameEl = doc.querySelector('[data-footer-name]');
  if (footerNameEl) footerNameEl.textContent = data.profile.name;

  const navList = doc.querySelector('[data-nav-links]');
  if (navList) {
    navList.innerHTML = data.settings.nav
      .filter((item) => data.settings.sections?.[item.id]?.enabled !== false)
      .map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.label)}</a></li>`)
      .join('');
  }

  const cv = doc.querySelector('[data-cv-link]');
  if (cv) {
    cv.setAttribute('href', data.settings.cv.path);
    cv.setAttribute('download', data.settings.cv.downloadName);
  }

  const year = doc.querySelector('[data-footer-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  doc.title = data.settings.siteTitle;
}

/** Hide any section switched off in settings, so an empty one never ships. */
function applyVisibility(doc, settings) {
  for (const [id, config] of Object.entries(settings.sections ?? {})) {
    const el = doc.getElementById(id);
    if (el && config.enabled === false) el.hidden = true;
  }
}

export function renderAll(doc, data, timeline) {
  renderChrome(doc, data);
  renderHero(doc, data.profile);
  renderAbout(doc, data.summary);
  renderPath(doc, timeline);
  renderNumbers(doc, data.metrics);
  renderWork(doc, data.projects);
  renderSkills(doc, data.skills);
  renderContact(doc, data.profile);
  applyVisibility(doc, data.settings);
}
