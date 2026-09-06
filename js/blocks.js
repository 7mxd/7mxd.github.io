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

/** A responsive figure. `sizes` tells the browser how wide it will render. */
export function imageMarkup(image, sizes) {
  const caption = image.caption
    ? `<figcaption>${escapeHtml(image.caption)}</figcaption>`
    : '';
  const srcset = image.srcSmall && image.srcSmall !== image.src
    ? ` srcset="${escapeHtml(image.srcSmall)} 800w, ${escapeHtml(image.src)} 1600w" sizes="${escapeHtml(sizes)}"`
    : '';
  return `<figure class="figure">
<img src="${escapeHtml(image.src)}"${srcset} alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">
${caption}</figure>`;
}

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
    { src: b.src, srcSmall: b.srcSmall || b.src, alt: b.alt, caption: b.caption || '', width: b.width || 0, height: b.height || 0 },
    '(min-width: 40rem) 46rem, 100vw',
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

export function renderBlocks(blocks) {
  return (blocks ?? []).map(renderBlock).join('');
}
