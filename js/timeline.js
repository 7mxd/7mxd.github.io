/** Compose the reverse-chronological timeline from the content files.
 *
 *  Nothing here touches the DOM. The timeline is assembled rather than
 *  authored, so adding a role in the admin puts it on the timeline with
 *  no second edit. */

export const KIND_ORDER = { role: 0, education: 1, project: 2, milestone: 3 };

const DATE = /^(\d{4})(-(0[1-9]|1[0-2]))?$/;

/** Interface labels, not content: they format a date, they do not say anything
 *  about Ahmed. Fixed rather than Intl.DateTimeFormat so the badge reads the
 *  same on every machine and the render tests can assert it. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function yearOf(value) {
  const match = DATE.exec(String(value ?? '').trim());
  return match ? Number(match[1]) : null;
}

/** The entry's own stop on the rail, under the year station its group is
 *  headed by. A year alone made the chronology unreadable: four entries sat
 *  under one 2024 badge in December, September, April and March order with
 *  nothing saying so. A year-only source date leaves `month` empty rather than
 *  inventing one; render.js draws no stop for it. */
function badgeOf(value) {
  const match = DATE.exec(String(value ?? '').trim());
  if (!match) return null;
  const month = match[3] ? MONTHS[Number(match[3]) - 1] : '';
  return { month, year: match[1] };
}

function entry(fields) {
  return {
    id: fields.id,
    kind: fields.kind,
    sortDate: fields.sortDate,
    year: fields.year,
    badge: badgeOf(fields.sortDate),
    order: fields.order ?? null,
    title: fields.title,
    org: fields.org ?? '',
    orgLogo: fields.orgLogo ?? null,
    location: fields.location ?? '',
    dateRange: fields.dateRange ?? '',
    bullets: fields.bullets ?? [],
    images: fields.images ?? [],
    blocks: fields.blocks ?? [],
    workRef: fields.workRef ?? null,
    link: fields.link ?? null,
    outboundLinks: fields.outboundLinks ?? null,
    workRefTitle: null,
    /** Which file and record this row was composed from. The admin needs it to
     *  open the right form; the site ignores it. */
    source: fields.source ?? null,
    note: fields.note ?? '',
  };
}

function fromExperience(experience) {
  const out = [];
  for (const company of experience.items ?? []) {
    for (const role of company.roles ?? []) {
      const year = yearOf(role.startDate);
      if (year === null) continue;
      out.push(entry({
        id: role.id, kind: 'role', sortDate: role.startDate, year, order: role.order,
        title: role.title, org: company.company, orgLogo: company.logo ?? null,
        location: company.location, dateRange: role.displayDate,
        bullets: role.bullets, images: role.images, blocks: role.blocks,
        workRef: role.workRef,
        source: { collection: 'experience', id: role.id },
      }));
    }
  }
  return out;
}

function fromEducation(education) {
  const out = [];
  for (const item of education.items ?? []) {
    const year = yearOf(item.endDate);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'education', sortDate: item.endDate, year, order: item.order,
      title: item.degree, org: item.institution, orgLogo: item.logo ?? null,
      location: item.location, dateRange: item.displayDate,
      note: item.grade, images: item.images, blocks: item.blocks,
      source: { collection: 'education', id: item.id },
    }));
  }
  return out;
}

function fromProjects(projects) {
  const out = [];
  for (const item of projects.items ?? []) {
    if (item.timeline !== true) continue;
    const year = yearOf(item.startDate);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'project', sortDate: item.startDate, year, order: item.order,
      title: item.title, org: item.org, dateRange: item.displayDate,
      // Not `blocks` and not `images`: those are the Selected Work entry's
      // depth, and duplicating them here is what the spec's no-duplication
      // rule forbids. These are the few lines that give a reader a reason to
      // follow the link at all.
      bullets: item.timelineBullets,
      outboundLinks: item.links,
      workRef: item.id,
      source: { collection: 'projects', id: item.id },
    }));
  }
  return out;
}

function fromMilestones(milestones) {
  const out = [];
  for (const item of milestones.items ?? []) {
    const year = yearOf(item.date);
    if (year === null) continue;
    out.push(entry({
      id: item.id, kind: 'milestone', sortDate: item.date, year, order: item.order,
      title: item.title, org: item.org, note: item.note, images: item.images,
      link: item.link,
      source: { collection: 'milestones', id: item.id },
    }));
  }
  return out;
}

function compare(a, b) {
  if (a.sortDate !== b.sortDate) return a.sortDate > b.sortDate ? -1 : 1;
  const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
}

/** Build year groups, newest first. */
export function buildTimeline({ experience = {}, education = {}, projects = {}, milestones = {} } = {}) {
  const all = [
    ...fromExperience(experience),
    ...fromEducation(education),
    ...fromProjects(projects),
    ...fromMilestones(milestones),
  ].sort(compare);

  // A role's bullets span everything it covered, and its link points at one of
  // those things. "Read more about this work" therefore claimed the whole block
  // was one project. Carrying the target's title lets the link name what it
  // actually opens. A project entry links to itself, so it needs no name.
  const titles = new Map((projects.items ?? []).map((p) => [p.id, p.title]));
  for (const item of all) {
    if (item.workRef && item.workRef !== item.id) {
      item.workRefTitle = titles.get(item.workRef) ?? null;
    }
  }

  const groups = new Map();
  for (const item of all) {
    if (!groups.has(item.year)) groups.set(item.year, []);
    groups.get(item.year).push(item);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, entries]) => ({ year, entries }));
}
