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

  // Pills place a scanner in three seconds without asking them to read a
  // sentence. They carry no tense, which is why the degree belongs here rather
  // than in the tagline (he graduated in 2023) and why the Saal.ai pill is a
  // closed date range: it is already true, and it stays true after the contract
  // ends without anyone editing anything.
  const pills = (profile.pills ?? []).length
    ? `<ul class="hero-pills">${profile.pills.map((p) => {
        const attrs = p.lang === 'ar' ? ' lang="ar" dir="rtl"' : '';
        return `<li${attrs}>${escapeHtml(p.label)}</li>`;
      }).join('')}</ul>`
    : '';

  // The ask, as its own element. It was the fourth sentence of an eleven-line
  // About paragraph, which is no place for the one thing the page wants the
  // reader to act on. It sits on a plate — see .hero-status in
  // css/sections.css for why a plate, and not the dot this once ruled out.
  const status = profile.status
    ? `<p class="hero-status">${escapeHtml(profile.status)}</p>`
    : '';

  doc.getElementById('hero').innerHTML = `
${portrait}
<div class="hero-text">
  <h1 class="hero-name">${escapeHtml(profile.name)}</h1>
  <p class="hero-name-ar" lang="ar" dir="rtl">${escapeHtml(profile.nameArabic)}</p>
  <p class="hero-role">${escapeHtml(profile.role)}</p>
  <p class="hero-tagline">${escapeHtml(profile.tagline)}</p>
  ${pills}
  ${status}
  <p class="hero-links">${links}</p>
</div>`;
}

function renderAbout(doc, summary) {
  // Blank lines separate paragraphs. One eleven-line block gives a scanner no
  // entry point, and the split is authored in the data rather than guessed at
  // by sentence count.
  const paragraphs = String(summary.content ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="prose">${escapeHtml(p)}</p>`)
    .join('');
  doc.getElementById('about').innerHTML = `${heading('about', 'About')}${paragraphs}`;
}

/** The organisation's mark, as a small anchor ahead of its name in the meta
 *  row. It matters most for the 2024-2026 stretch: two years of career with no
 *  photograph available and none possible (the work is client audit software),
 *  which the spec says the Saal.ai mark carries.
 *
 *  Decorative, so alt is empty: the organisation's name sits immediately after
 *  it as real text, and a screen reader repeating "Saal.ai logo, Saal.ai" is
 *  worse than silence. The chip is a fixed square, so the mark reserves its own
 *  space and nothing shifts when it loads.
 *
 *  Two <img> elements rather than <picture>, because the theme is a data-theme
 *  attribute the visitor can toggle, not the OS preference a media condition
 *  would see. Marks with no dark variant (the three third-party logos, all dark
 *  ink) get a light chip behind them instead. */
function orgLogoMarkup(logo) {
  if (!logo) return '';
  if (logo.light && logo.dark) {
    return `<span class="entry-logo">`
      + `<img class="entry-logo-light" src="${escapeHtml(logo.light)}" alt="" loading="lazy" decoding="async">`
      + `<img class="entry-logo-dark" src="${escapeHtml(logo.dark)}" alt="" loading="lazy" decoding="async">`
      + `</span>`;
  }
  const only = logo.default || logo.light || logo.dark;
  if (!only) return '';
  return `<span class="entry-logo is-plated"><img src="${escapeHtml(only)}" alt="" loading="lazy" decoding="async"></span>`;
}

function entryMarkup(entry) {
  const bullets = entry.bullets.length
    ? `<ul class="entry-bullets">${entry.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    : '';
  const note = entry.note ? `<p class="entry-note">${escapeHtml(entry.note)}</p>` : '';
  const org = entry.org
    ? `${orgLogoMarkup(entry.orgLogo)}<span class="entry-org">${escapeHtml(entry.org)}</span>`
    : '';
  const dates = entry.dateRange ? `<span class="entry-dates">${escapeHtml(entry.dateRange)}</span>` : '';
  const links = [];
  if (entry.workRef) {
    // Name the target when it is not this entry. A role's bullets span
    // everything it covered, so "Read more about this work" read as a claim
    // that the whole block was the one project the link opens.
    const label = entry.workRefTitle
      ? `Read more: ${escapeHtml(entry.workRefTitle)}`
      : 'Read more about this work';
    links.push(`<a href="#work-${escapeHtml(entry.workRef)}">${label}</a>`);
  } else if (entry.link) {
    links.push(`<a href="${escapeHtml(entry.link.url)}" rel="noopener">${escapeHtml(entry.link.label)}</a>`);
  }
  // A published app that nobody can open from the entry describing it is a
  // dead end. Labels are interface, not content, so they live here.
  for (const [key, label] of [['webapp', 'Website'], ['ios', 'App Store'], ['github', 'GitHub']]) {
    const url = entry.outboundLinks?.[key];
    if (url) links.push(`<a href="${escapeHtml(url)}" rel="noopener">${label}</a>`);
  }
  const more = links.length ? `<p class="entry-more">${links.join('')}</p>` : '';

  return `<li class="entry is-${escapeHtml(entry.kind)}">
${badgeMarkup(entry)}<div class="entry-body">
<h3 class="entry-title">${escapeHtml(entry.title)}</h3>
<p class="entry-meta">${org}${dates}</p>
${note}${renderBlocks(entry.blocks)}${bullets}${more}${gallery(entry.images, 'entry')}
</div>
</li>`;
}

/** A month stop on the rail, under the year station its group is headed by.
 *  Month and year in one badge was the first attempt: it fit, but two lines of
 *  small type in a circle read as a label rather than as a marker, and the year
 *  repeated down every entry in a run. The year belongs to the group; only the
 *  month changes per entry, so only the month is here.
 *
 *  An entry whose source date carries no month — the school diploma is the only
 *  one — gets no stop rather than an invented one. Its year station is directly
 *  above it. */
function badgeMarkup(entry) {
  if (!entry.badge || !entry.badge.month) return '<span class="entry-badge is-undated"></span>';
  const { month, year } = entry.badge;
  const iso = `${year}-${String(MONTH_NUMBER[month]).padStart(2, '0')}`;
  return `<time class="entry-badge" datetime="${escapeHtml(iso)}">${escapeHtml(month)}</time>`;
}

const MONTH_NUMBER = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function renderPath(doc, timeline) {
  // Two sizes of station on one rail: a year opens each run, and each entry
  // marks its month under it. A flat list of month-and-year badges was tried
  // and repeated the year down every entry; a year alone left four 2024 entries
  // in December, September, April and March order with nothing saying so.
  const groups = timeline.map((group) => `
<section class="year-group" aria-labelledby="year-${group.year}">
  <h3 class="year-label" id="year-${group.year}">${group.year}</h3>
  <ol class="entries">${group.entries.map(entryMarkup).join('')}</ol>
</section>`).join('');

  const span = timeline.length
    ? `<p class="section-note">${timeline[0].year} to ${timeline[timeline.length - 1].year}</p>`
    : '';

  // The wrapper exists so a single continuous rail can be drawn behind every
  // station (css/sections.css .timeline::before). Drawing it per group would
  // break the line at each boundary, which is the thing that makes a timeline
  // read as one chronology rather than a stack of lists.
  doc.getElementById('path').innerHTML =
    `${heading('path', 'The path so far')}${span}<div class="timeline">${groups}</div>`;
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
  // `primary` marks the five tools Ahmed's own summary names. Thirty-three
  // items all set identically is a keyword dump: Python weighs the same as
  // lubridate and the eye has nowhere to land. The flag is the whole hierarchy.
  const groups = skills.categories.map((cat) => {
    const items = cat.items.map((i) => {
      const level = cat.type === 'languages' && i.level
        ? ` <span class="skill-level">${escapeHtml(i.level)}</span>`
        : '';
      return `<li${i.primary ? ' class="is-primary"' : ''}>${escapeHtml(i.name)}${level}</li>`;
    }).join('');
    return `<div class="skill-group">
<h3 class="skill-group-name">${escapeHtml(cat.name)}</h3>
<ul class="skill-list">${items}</ul>
</div>`;
  }).join('');
  // The legend, because emphasis with no stated meaning reads as arbitrary —
  // the first person to see the bold asked what it meant. Rendered only when
  // something is actually flagged, so clearing every `primary` in the admin
  // removes the sentence rather than leaving it explaining nothing.
  const emphasised = skills.categories.some((cat) => cat.items.some((i) => i.primary));
  const legend = emphasised
    ? '<p class="section-note">Bold marks the ones used most.</p>'
    : '';

  doc.getElementById('skills').innerHTML =
    `${heading('skills', 'Skills')}${legend}<div class="skill-groups">${groups}</div>`;
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
