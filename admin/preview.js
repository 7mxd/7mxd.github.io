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
 *  module has no `invalidate` — there is no cache for it to clear. */
export function createPreview(iframe, getBase) {
  let timer = null;
  let ready = false;

  iframe.addEventListener('load', () => { ready = true; });

  async function render(collectionName, data) {
    if (!ready || !iframe.contentDocument) return;
    const base = await getBase();
    const merged = normalizeSiteImages(mergeForPreview(base, collectionName, data));
    renderAll(iframe.contentDocument, merged, buildTimeline(merged));
  }

  return {
    /** Debounced: typing should not re-render the whole page per keystroke. */
    update(collectionName, data) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        render(collectionName, data).catch(() => {
          // A merge the site cannot render leaves the last good frame on
          // screen. Showing a half-built record is worse than showing the
          // previous one — and this is not a rare path: normalizeSiteImages
          // throws for any image with no src or alt text yet, which is
          // exactly the shape of a photograph row the moment it is added.
        });
      }, 250);
    },
    destroy() { clearTimeout(timer); },
  };
}
