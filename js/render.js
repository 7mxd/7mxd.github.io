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
    full:   { sizes: '(min-width: 40rem) 37rem, 60vw', maxPx: 592, capPx: 0 },
    column: { sizes: '(min-width: 40rem) 18rem, 60vw', maxPx: 288, capPx: 0 },
  },
  work: {
    single: { sizes: '(min-width: 40rem) 42rem, calc(100vw - 2.5rem)', maxPx: 674, capPx: 416 },
    full:   { sizes: '(min-width: 40rem) 13rem, 70vw', maxPx: 208, capPx: 416 },
    column: { sizes: '(min-width: 40rem) 13rem, 70vw', maxPx: 208, capPx: 416 },
  },
};

/** The hero portrait is 11rem wide, 8rem below the 40rem breakpoint. */
const PORTRAIT_SIZES = '(max-width: 40rem) 8rem, 11rem';

function heading(id, text) {
  return `<h2 class="section-heading" id="${id}-heading">${escapeHtml(text)}</h2>`;
}

/** Link icons.
 *
 *  Two families on purpose, because they do different jobs. `mail` and
 *  `external` are drawn in the stroked 24-unit line style index.html already
 *  uses for the CV button and the theme toggle, so they read as interface. The
 *  two brand marks are the companies' own filled glyphs, because a stroked
 *  approximation of a logo is neither recognisable nor correct — and
 *  recognisability is the entire reason to put a mark beside "LinkedIn".
 *
 *  Every one is aria-hidden. The link text already says where it goes, and an
 *  icon that announces itself only makes a screen reader repeat the label. */
const STROKE = 'viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" '
  + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const FILL = 'viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"';

const ICONS = {
  mail: `<svg class="link-icon" ${STROKE}><rect x="3" y="5" width="18" height="14" rx="2"></rect>`
    + `<polyline points="3.5 7 12 13 20.5 7"></polyline></svg>`,
  linkedin: `<svg class="link-icon" ${FILL}><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.04c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"></path></svg>`,
  github: `<svg class="link-icon" ${FILL}><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.82-.26.82-.58l-.015-2.04c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.36.81 1.1.81 2.22l-.015 3.29c0 .31.21.69.83.57A12 12 0 0 0 12 .3z"></path></svg>`,
  globe: `<svg class="link-icon" ${STROKE}><circle cx="12" cy="12" r="9"></circle>`
    + `<path d="M3.2 9.5h17.6M3.2 14.5h17.6"></path>`
    + `<path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"></path></svg>`,
  // A phone, not the Apple mark. LinkedIn and GitHub publish their glyphs for
  // linking to a profile; Apple's guidelines reserve theirs and sanction only
  // the full "Download on the App Store" badge, which is far too heavy for a
  // link row. A handset beside the words "App Store" is unambiguous anyway.
  app: `<svg class="link-icon" ${STROKE}><rect x="6" y="2.5" width="12" height="19" rx="2.5"></rect>`
    + `<path d="M10.5 18.5h3"></path></svg>`,
  // Marks a link that leaves the site. The page had no such signal, so "Verify"
  // (an issuer's page) looked identical to "Read more" (a jump further down the
  // same page).
  external: `<svg class="link-icon is-external" ${STROKE}><path d="M14 4h6v6"></path>`
    + `<path d="M20 4l-8.6 8.6"></path>`
    + `<path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5"></path></svg>`,
};

/** The icon a link earns. `kind` names it where the destination is known from
 *  the data (a project's App Store or website URL); everything else is inferred
 *  from the href, and anything outbound with no better mark gets the arrow. */
function outboundIcon(href, kind) {
  if (kind && ICONS[kind]) return ICONS[kind];
  const url = String(href ?? '');
  if (/^https?:\/\/(www\.)?linkedin\.com/i.test(url)) return ICONS.linkedin;
  if (/^https?:\/\/(www\.)?github\.com/i.test(url)) return ICONS.github;
  if (/^mailto:/i.test(url)) return ICONS.mail;
  return /^https?:/i.test(url) ? ICONS.external : '';
}

/** An anchor with its icon, for the rows where links sit together. */
function iconLink(href, label, kind) {
  return `<a href="${escapeHtml(href)}">${outboundIcon(href, kind)}<span>${escapeHtml(label)}</span></a>`;
}

/** In a timeline gallery with an odd number of photographs the LEAD image spans
 *  both columns and the rest pair off beneath it
 *  (`:first-child:nth-last-child(odd)` in css/sections.css). A Selected Work
 *  gallery overrides that back to a single column. */
function slotFor(context, index, count) {
  const slots = GALLERY_SLOTS[context];
  if (count === 1) return slots.single;
  const spans = context === 'entry' && count % 2 === 1 && index === 0;
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
 *  sitting in a half column.
 *
 *  Below 40rem a multi-image gallery becomes a horizontal swipe strip
 *  (css/sections.css), which makes it a scrollable region: WCAG requires those
 *  to be reachable and operable by keyboard, so it takes a tabindex and a name.
 *  A single image never overflows, so it gets neither.
 *
 *  The tabindex is static, which costs a tab stop on desktop where the strip is
 *  a grid and does not scroll. The alternative is a resize listener toggling
 *  the attribute — more moving parts, and the kind of thing that breaks quietly
 *  later. A labelled stop that does nothing is the cheaper of the two failures. */
function gallery(images, context) {
  if (!images || images.length === 0) return '';
  const scrolls = images.length > 1;
  const modifier = scrolls ? 'is-grid' : 'is-single';
  const region = scrolls ? ' tabindex="0" role="group" aria-label="Photographs"' : '';
  const figures = images
    .map((img, i) => imageMarkup(img, sizesFor(slotFor(context, i, images.length), img)))
    .join('');
  return `<div class="gallery ${modifier}" data-count="${images.length}"${region}>${figures}</div>`;
}

function renderHero(doc, profile) {
  const links = [
    iconLink(`mailto:${profile.contact.email}`, profile.contact.email),
    profile.contact.linkedin ? iconLink(profile.contact.linkedin.url, profile.contact.linkedin.label) : '',
    profile.contact.github ? iconLink(profile.contact.github.url, profile.contact.github.label) : '',
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
    links.push(`<a href="${escapeHtml(entry.link.url)}" rel="noopener">${outboundIcon(entry.link.url)}<span>${escapeHtml(entry.link.label)}</span></a>`);
  }
  // A published app that nobody can open from the entry describing it is a
  // dead end. Labels are interface, not content, so they live here.
  for (const [key, label, kind] of [['webapp', 'Website', 'globe'], ['ios', 'App Store', 'app'], ['github', 'GitHub', null]]) {
    const url = entry.outboundLinks?.[key];
    if (url) links.push(`<a href="${escapeHtml(url)}" rel="noopener">${outboundIcon(url, kind)}<span>${label}</span></a>`);
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

  const named = [['ios', 'App Store', 'app'], ['webapp', 'Website', 'globe'], ['github', 'GitHub', null]];
  const links = [];
  for (const [key, label, kind] of named) {
    if (project.links?.[key]) links.push(iconLink(project.links[key], label, kind));
  }
  for (const extra of project.links?.extra ?? []) {
    links.push(`<a href="${escapeHtml(extra.url)}">${outboundIcon(extra.url)}<span>${escapeHtml(extra.label)}</span></a>`);
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
  // `primary` marks what Ahmed reaches for most. Thirty-three items all set
  // identically is a keyword dump: Python weighs the same as lubridate and the
  // eye has nowhere to land. The flag is the whole hierarchy, so keep it to a
  // few — the point is what stands out, not how much does.
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
  <span class="contact-label">${outboundIcon(href)}<span>${escapeHtml(label)}</span></span>
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
