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

/** How long the preview waits for the site inside it to say it has rendered
 *  before giving up and saying so. Generous — the iframe starts navigating
 *  at parse time and normally beats the admin's own boot — but bounded: the
 *  alternative is waiting forever behind a frame that looks like the live
 *  site and never moves again. */
export const READY_TIMEOUT = 20000;

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
export function createPreview(iframe, getBase, { timeout = READY_TIMEOUT } = {}) {
  let timer = null;
  let ready = false;
  let pending = null;
  let watching = false;
  let stallTimer = null;
  let notice = null;

  function markReady() {
    if (ready) return;
    ready = true;
    clearTimeout(stallTimer);
    clearUnavailable();
    if (!pending) return;
    const { collectionName, data } = pending;
    pending = null;
    render(collectionName, data).catch(logRenderError);
  }

  /** The readiness path, shared by the `load` event and the direct call
   *  below. `watching` is what keeps it from running twice: a single-threaded
   *  page cannot interleave the two entry points, so whichever arrives first
   *  claims the document and the other becomes a no-op rather than attaching
   *  a second listener. */
  function watchDocument() {
    if (watching || ready) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    // Every iframe starts on the `about:blank` document that its own `src`
    // navigation then throws away. That document carries no site render and
    // never will, so claiming it here would spend the single attach on a
    // document already on its way out and leave the real one unwatched —
    // the same dead preview this function exists to prevent, arrived at from
    // the other side. `loading` is that story one step later: the real
    // document exists but none of its scripts have run, so leave it to the
    // `load` event rather than racing them.
    if (doc.readyState === 'loading' || doc.URL === 'about:blank') return;
    watching = true;
    if (doc.documentElement.dataset.rendered === 'true') markReady();
    else doc.addEventListener('site:rendered', markReady, { once: true });
  }

  // The pane around the frame, not a document this module does not own. If
  // readiness never arrives — the site's own boot threw before its `finally`,
  // or the iframe never loaded at all — the frame just sits there showing the
  // published page, which is indistinguishable from a preview that is simply
  // up to date. Saying so is the whole point: quiet, textual, and in the
  // admin's own tokens.
  const pane = iframe.parentNode;

  function showUnavailable() {
    if (ready || notice || !pane) return;
    const doc = iframe.ownerDocument;
    if (!doc) return;
    iframe.hidden = true;
    notice = doc.createElement('p');
    notice.className = 'preview-unavailable';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Preview unavailable — the page in this pane never '
      + 'finished loading, so it is not showing your edits. Editing and saving '
      + 'still work. Reload to try again.';
    pane.appendChild(notice);
  }

  function clearUnavailable() {
    if (!notice) return;
    notice.remove();
    notice = null;
    iframe.hidden = false;
  }

  // Started before the readiness attach below, not after: that attach can
  // mark the preview ready synchronously, and a timer armed afterwards would
  // outlive the thing it was meant to time and cover a working preview with
  // a failure notice twenty seconds in.
  stallTimer = setTimeout(showUnavailable, timeout);

  // `watching` marks a document claimed, not the module's whole lifetime: a
  // `load` means the frame just navigated to a new document, so the claim on
  // whatever came before it is void. Nothing here actually navigates the
  // iframe away once it starts, but the flag should track the document it
  // was named for rather than outlive it on a technicality.
  iframe.addEventListener('load', () => { watching = false; watchDocument(); });
  // …and again, right now, because `load` may already have fired. admin/app.js
  // constructs the preview only after loadAll()'s ten authenticated,
  // never-cached GitHub calls resolve, while <iframe src="/"> begins
  // navigating at HTML parse time and `hidden` does not defer it. On any
  // reload with a warm cache the iframe wins that race and there is no `load`
  // event left to hear: without this call the handler above never runs,
  // `ready` stays false, and every update() parks in the not-ready branch
  // forever — a preview pane showing the published site, reflecting no edit,
  // with nothing in the console. A cold cache works, which is exactly why it
  // reads as flaky rather than broken.
  watchDocument();

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
