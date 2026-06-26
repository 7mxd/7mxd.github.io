import { escapeHtml, formatList } from './util.js';

const renderers = {
  description: (b) => `<p class="block-desc">${escapeHtml(b.content)}</p>`,
  responsibility: (b) => `<li class="block-resp">${escapeHtml(b.content)}</li>`,
  honor: (b) => `<p class="block-honor">${escapeHtml(b.content)}</p>`,
  metric: (b) =>
    `<div class="block-metric"><span class="metric-value" data-countup="${escapeHtml(b.value)}">${escapeHtml(b.value)}</span><span class="metric-label">${escapeHtml(b.label)}</span></div>`,
  'ascii-chart': (b) => {
    const cap = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : '';
    return `<figure class="block-ascii">${cap}<pre class="ascii" data-animate="ascii">${escapeHtml(b.chart)}</pre></figure>`;
  },
  image: (b) => {
    const cap = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : '';
    return `<figure class="block-image"><img loading="lazy" src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt)}">${cap}</figure>`;
  },
  code: (b) => {
    const lang = b.language ? ` data-lang="${escapeHtml(b.language)}"` : '';
    return `<pre class="block-code"${lang}><code>${escapeHtml(b.content)}</code></pre>`;
  },
  callout: (b) => `<aside class="block-callout" data-tone="${escapeHtml(b.tone)}">${escapeHtml(b.content)}</aside>`,
  html: (b) => b.content || '',
  'linked-artifact': (b) =>
    `<a class="block-artifact" href="${escapeHtml(b.url)}" target="_blank" rel="noopener">${escapeHtml(b.label)}</a>`,
  coursework: (b) => `<ul class="block-coursework">${(b.items||[]).map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul>`,
  thesis: (b) => {
    const t = escapeHtml(b.title);
    return b.link ? `<p class="block-thesis"><a href="${escapeHtml(b.link)}" target="_blank" rel="noopener">${t}</a></p>`
                  : `<p class="block-thesis">${t}</p>`;
  }
};

export function renderBlock(block, ctx = {}) {
  const fn = renderers[block?.type];
  return fn ? fn(block, ctx) : '';
}
export function renderBlocks(blocks, ctx = {}) {
  return (blocks || []).map((b) => renderBlock(b, ctx)).join('');
}
