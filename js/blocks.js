/** Block rendering. Every renderer returns an HTML string and escapes its input.
 *  Block types are declared in data/blocks-registry.json; the dispatch table
 *  below must stay in step with it. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** The candidate list for a two-variant photograph, with `w` descriptors taken
 *  from the files' REAL widths rather than from the numbers in their names.
 *  tools/process_photos.py caps the long edge, so a portrait derivative is much
 *  narrower than its filename claims — the Stmnt captures are 369 and 738 wide,
 *  not 800 and 1600. Describing them as 800w/1600w told the browser they were
 *  twice the resolution they are, and it duly picked the smaller file for slots
 *  the larger one should have filled.
 *
 *  Returns '' when there is nothing honest to say: one variant, or a missing
 *  width. A plain `src` renders correctly; a lie about resolution does not. */
export function srcsetAttr(image) {
  const { src, srcSmall } = image;
  const width = Number(image.width) || 0;
  const widthSmall = Number(image.widthSmall) || 0;
  if (!srcSmall || srcSmall === src || !width || !widthSmall || widthSmall >= width) return '';
  return `${escapeHtml(srcSmall)} ${widthSmall}w, ${escapeHtml(src)} ${width}w`;
}

/** A responsive figure. `sizes` tells the browser how wide it will render. */
export function imageMarkup(image, sizes) {
  const caption = image.caption
    ? `<figcaption>${escapeHtml(image.caption)}</figcaption>`
    : '';
  const candidates = srcsetAttr(image);
  const srcset = candidates
    ? ` srcset="${candidates}" sizes="${escapeHtml(sizes)}"`
    : '';
  return `<figure class="figure">
<img src="${escapeHtml(image.src)}"${srcset} alt="${escapeHtml(image.alt)}" width="${Number(image.width) || 0}" height="${Number(image.height) || 0}" loading="lazy" decoding="async">
${caption}</figure>`;
}

/** A block-authored image runs the full reading measure. It can sit in a
 *  timeline entry (widest slot 37rem, measured) or in a Selected Work article
 *  (42rem, measured), and a block does not know which, so it declares the wider
 *  of the two: over-declaring costs a slightly larger file, under-declaring
 *  costs sharpness. js/render.js has the measured table for the gallery slots
 *  it does know the context of. */
const BLOCK_IMAGE_SIZES = '(min-width: 40rem) 42rem, calc(100vw - 2.5rem)';

const RENDERERS = {
  description: (b) => `<p class="block-text">${escapeHtml(b.content)}</p>`,

  responsibility: (b) => `<li class="block-bullet">${escapeHtml(b.content)}</li>`,

  callout: (b) =>
    `<aside class="block-callout is-${escapeHtml(b.tone || 'note')}">${escapeHtml(b.content)}</aside>`,

  metric: (b) =>
    `<p class="block-metric"><span class="block-metric-value">${escapeHtml(b.value)}</span> <span class="block-metric-label">${escapeHtml(b.label)}</span></p>`,

  'linked-artifact': (b) =>
    `<p class="block-link"><a href="${escapeHtml(b.url)}">${escapeHtml(b.label)}</a></p>`,

  honor: (b) => `<p class="block-honor">${escapeHtml(b.content)}</p>`,

  thesis: (b) => {
    const title = escapeHtml(b.title);
    const inner = b.link ? `<a href="${escapeHtml(b.link)}">${title}</a>` : title;
    return `<p class="block-thesis"><span class="block-label">Thesis</span> ${inner}</p>`;
  },

  coursework: (b) => {
    const items = (b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
    return `<ul class="block-coursework">${items}</ul>`;
  },

  code: (b) =>
    `<pre class="block-code"><code>${escapeHtml(b.content)}</code></pre>`,

  html: (b) => String(b.content ?? ''),

  image: (b) => imageMarkup(
    {
      src: b.src, srcSmall: b.srcSmall || b.src, alt: b.alt, caption: b.caption || '',
      width: Number(b.width) || 0, height: Number(b.height) || 0, widthSmall: Number(b.widthSmall) || 0,
    },
    BLOCK_IMAGE_SIZES,
  ),

  benchmark: (b) => {
    const caption = b.caption ? `<caption>${escapeHtml(b.caption)}</caption>` : '';
    const rows = (b.rows ?? []).map((r) =>
      `<tr${r.highlight ? ' class="is-mine"' : ''}><th scope="row">${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`,
    ).join('');
    return `<table class="benchmark">${caption}
<thead><tr><th scope="col">Method</th><th scope="col">${escapeHtml(b.unit)}</th></tr></thead>
<tbody>${rows}</tbody></table>`;
  },
};

/** Render one block. Unknown types render nothing, so retiring a type in the
 *  registry cannot break a page that still has stale data. */
export function renderBlock(block) {
  const renderer = RENDERERS[block?.type];
  return renderer ? renderer(block) : '';
}

/** Render a run of blocks.
 *
 *  `responsibility` is the one renderer that emits a list item rather than a
 *  self-contained element, so a run of consecutive ones is wrapped in a single
 *  <ul> here. Emitting a bare <li> is invalid HTML and, more to the point,
 *  gives a screen reader no list to announce — no item count, no position. */
export function renderBlocks(blocks) {
  const out = [];
  let bullets = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    out.push(`<ul class="block-bullets">${bullets.join('')}</ul>`);
    bullets = [];
  };

  for (const block of blocks ?? []) {
    if (block && block.type === 'responsibility') {
      bullets.push(renderBlock(block));
      continue;
    }
    flushBullets();
    out.push(renderBlock(block));
  }
  flushBullets();
  return out.join('');
}
