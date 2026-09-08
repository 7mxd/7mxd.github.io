/** The preview is the site.
 *
 *  js/render.js's renderAll(doc, data, timeline) takes any document, and the
 *  admin is same-origin with the site, so the preview is an <iframe src="/">
 *  re-rendered by the site's own renderer with the edited data. There is no
 *  second renderer to keep in step — which is the whole reason this is cheap
 *  enough to build. */
import { normalizeSiteImages } from '../js/data.js';
import { buildTimeline } from '../js/timeline.js';
import { renderAll } from '../js/render.js';

/** A full dataset with one collection swapped. Never mutates the base. */
export function mergeForPreview(base, collectionName, data) {
  return { ...base, [collectionName]: data };
}

/** `getBase` returns the full ten-key site dataset (see js/data.js's
 *  validateSiteData), built fresh from the admin's own live models — see
 *  admin/app.js's buildPreviewBase. Every collection is already in memory
 *  and edited in place there, so there is nothing to cache: a cached copy
 *  could only ever go stale between one keystroke and the next, and a cache
 *  whose miss can never happen has no reason to exist. That is also why this
 *  module has no `invalidate` — there is no cache for it to clear.
 *
 *  The iframe's own `load` event fires once its shell has parsed — well
 *  before js/main.js's own async data fetch resolves and calls renderAll for
 *  the first time. If the preview painted an edit in that window, the site's
 *  own un-edited first render would land right after it and silently wipe
 *  it out: no visible error, just an edit that reverted itself. So instead
 *  of trusting `load`, this waits for js/main.js to say its own first render
 *  (success or failure) has actually landed — the `data-rendered` attribute
 *  and `site:rendered` event it sets in its `finally` block — and replays
 *  whatever the most recent `update()` asked for once that happens, so a
 *  keystroke during boot is delayed rather than lost. */
export function createPreview(iframe, getBase) {
  let timer = null;
  let ready = false;
  let pending = null;

  function markReady() {
    ready = true;
    if (!pending) return;
    const { collectionName, data } = pending;
    pending = null;
    render(collectionName, data).catch(logRenderError);
  }

  iframe.addEventListener('load', () => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    // The iframe may finish booting before the preview ever gets here — in
    // that case the mark is already set and there is no event left to wait
    // for. Checking first, then attaching the listener, closes that race:
    // nothing runs between the check and the attach in a single-threaded
    // page, so the event can neither be missed nor double-handled.
    if (doc.documentElement.dataset.rendered === 'true') markReady();
    else doc.addEventListener('site:rendered', markReady, { once: true });
  });

  function logRenderError(err) {
    // A merge the site cannot render — a half-typed record, a photograph
    // row with no src or alt yet — leaves the last good frame on screen,
    // which is correct: normalizeSiteImages throws for exactly that shape
    // in ordinary use, and showing nothing is better than showing a
    // half-built record. But the same catch would just as quietly hide a
    // real regression in renderAll or buildTimeline, forever. Logging costs
    // nothing in the common case and is the only way the rare one is ever
    // diagnosed.
    console.error('admin preview: could not render', err);
  }

  async function render(collectionName, data) {
    if (!iframe.contentDocument) return;
    const base = await getBase();
    const merged = normalizeSiteImages(mergeForPreview(base, collectionName, data));
    renderAll(iframe.contentDocument, merged, buildTimeline(merged));
  }

  return {
    /** Debounced: typing should not re-render the whole page per keystroke.
     *  If the site's own first render hasn't landed yet, the request is
     *  held rather than dropped and replayed by markReady() above. */
    update(collectionName, data) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!ready) { pending = { collectionName, data }; return; }
        render(collectionName, data).catch(logRenderError);
      }, 250);
    },
  };
}
