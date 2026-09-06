/** Loading and validation for the site's JSON content.
 *  Validation is pure so it can be unit tested without a DOM or a network. */

const FILES = {
  profile: 'profile',
  summary: 'summary',
  settings: 'settings',
  experience: 'experience',
  education: 'education',
  projects: 'projects',
  milestones: 'milestones',
  metrics: 'metrics',
  skills: 'skills',
  registry: 'blocks-registry',
};

/** Fill an image's optional fields and fail loudly if a required one is absent. */
export function normalizeImage(img) {
  if (!img || typeof img.src !== 'string' || img.src === '') {
    throw new TypeError('image requires a src');
  }
  if (typeof img.alt !== 'string' || img.alt.trim() === '') {
    throw new TypeError(`image ${img.src} requires alt text`);
  }
  return {
    src: img.src,
    srcSmall: img.srcSmall || img.src,
    alt: img.alt,
    caption: img.caption || '',
    width: Number(img.width) || 0,
    height: Number(img.height) || 0,
  };
}

const SHAPES = {
  profile: (v) => (v && v.name && v.role && v.contact ? null : 'profile needs name, role, contact'),
  summary: (v) => (v && typeof v.content === 'string' ? null : 'summary needs content'),
  settings: (v) => (v && v.cv && v.cv.path ? null : 'settings needs cv.path'),
  experience: (v) => (v && Array.isArray(v.items) ? null : 'experience needs items[]'),
  education: (v) => (v && Array.isArray(v.items) ? null : 'education needs items[]'),
  projects: (v) => (v && Array.isArray(v.items) ? null : 'projects needs items[]'),
  milestones: (v) => (v && Array.isArray(v.items) ? null : 'milestones needs items[]'),
  metrics: (v) => (v && Array.isArray(v.items) ? null : 'metrics needs items[]'),
  skills: (v) => (v && Array.isArray(v.categories) ? null : 'skills needs categories[]'),
  registry: (v) => (v && typeof v === 'object' ? null : 'registry must be an object'),
};

/** Check the payload's shape. Returns every problem rather than the first. */
export function validateSiteData(data) {
  const errors = [];
  for (const key of Object.keys(SHAPES)) {
    if (!(key in (data || {}))) {
      errors.push(`missing ${key}`);
      continue;
    }
    const problem = SHAPES[key](data[key]);
    if (problem) errors.push(problem);
  }
  if (data && data.profile && !data.profile.nameArabic) {
    errors.push('profile.nameArabic is required');
  }
  return { ok: errors.length === 0, errors };
}

/** Replace every image object reachable from the payload with its
 *  normalised form (filled-in srcSmall, caption, width, height), so a
 *  missing src or alt text fails loudly at load time instead of silently
 *  rendering an unlabelled image later. Images live in `profile.portrait`
 *  (a single object, optional) and in the `images[]` arrays on experience
 *  roles, education items, projects, and milestones.
 *
 *  Pure and DOM/network-free, so it is unit-testable on its own, without
 *  going through `loadSiteData`'s fetch. `loadSiteData` calls this after
 *  `validateSiteData` passes. */
export function normalizeSiteImages(data) {
  const normalizeList = (images) => (images ?? []).map(normalizeImage);

  const normalizeItemImages = (section) =>
    section && Array.isArray(section.items)
      ? { ...section, items: section.items.map((item) => ({ ...item, images: normalizeList(item.images) })) }
      : section;

  const profile = data && data.profile
    ? { ...data.profile, portrait: data.profile.portrait ? normalizeImage(data.profile.portrait) : data.profile.portrait }
    : data && data.profile;

  const experience = data && data.experience && Array.isArray(data.experience.items)
    ? {
        ...data.experience,
        items: data.experience.items.map((company) => ({
          ...company,
          roles: (company.roles ?? []).map((role) => ({ ...role, images: normalizeList(role.images) })),
        })),
      }
    : data && data.experience;

  return {
    ...data,
    profile,
    experience,
    education: normalizeItemImages(data && data.education),
    projects: normalizeItemImages(data && data.projects),
    milestones: normalizeItemImages(data && data.milestones),
  };
}

/** Fetch every content file in parallel, validate the result, and
 *  normalise every image it contains. */
export async function loadSiteData(base = '') {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const response = await fetch(`${base}data/${file}.json`);
      if (!response.ok) throw new Error(`failed to load ${file}.json (${response.status})`);
      return [key, await response.json()];
    }),
  );
  const data = Object.fromEntries(entries);
  const { ok, errors } = validateSiteData(data);
  if (!ok) throw new Error(`invalid site data: ${errors.join('; ')}`);
  return normalizeSiteImages(data);
}
