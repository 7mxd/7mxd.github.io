/** Form schema for the admin UI.
 *
 *  This file is load-bearing in a way that is easy to miss: admin/forms-model.js
 *  rebuilds each JSON file from these declarations ALONE. A field the site reads
 *  but this schema does not declare is silently deleted the first time an editor
 *  presses Save. So the rule is:
 *
 *    declare every field that appears in data/*.json or that js/ reads,
 *    and nothing else.
 *
 *  test/admin-roundtrip.test.js is the guard. It loads every real data file,
 *  runs it through buildFormModel then modelToData, and requires the result to
 *  deep-equal the input. If you add a field to a data file, add it here too or
 *  that test will fail.
 *
 *  Field order mirrors the order of keys in the data files, so a save with no
 *  edits produces a minimal diff rather than a wholesale reshuffle.
 */

/** src/alt/width/height are required together: a half-filled image is worse
 *  than no image, since js/data.js's normalizeImage throws on a missing src or
 *  alt and a missing width ships `width="0"`, which reintroduces layout shift.
 *  `widthSmall` is the small derivative's REAL width — tools/process_photos.py
 *  caps the long edge, so a portrait derivative is much narrower than the 800
 *  or 1600 in its filename, and js/blocks.js needs the true number for its
 *  srcset `w` descriptors. */
const imageFields = [
  { name:'src', label:'Photograph (large)', type:'image', required:true },
  { name:'srcSmall', label:'Photograph (small)', type:'image' },
  { name:'alt', label:'Alt text', type:'string', required:true },
  { name:'caption', label:'Caption', type:'string' },
  { name:'width', label:'Large width, px', type:'number', required:true },
  { name:'height', label:'Large height, px', type:'number', required:true },
  { name:'widthSmall', label:'Small width, px', type:'number' },
];

const imagesField = { name:'images', label:'Photographs', type:'list', fields: imageFields };
const tagsField = { name:'tags', label:'Tags', type:'list', itemField:{ name:'tag', label:'Tag', type:'string' } };
const bulletsField = { name:'bullets', label:'Bullets', type:'list', itemField:{ name:'bullet', label:'Bullet', type:'text' } };
// js/timeline.js breaks same-date ties on this before falling back to kind
// precedence, so it is a number, not a string: Number.isFinite() decides.
const orderField = { name:'order', label:'Timeline tie-break order', type:'number' };
const logoField = { name:'logo', label:'Logo', type:'object', fields:[
  { name:'default', label:'Default', type:'image' },
  { name:'light', label:'Light theme', type:'image' },
  { name:'dark', label:'Dark theme', type:'image' } ] };

export const COLLECTIONS = [
  { name:'profile', file:'data/profile.json', label:'Profile', kind:'single', fields:[
    { name:'name', label:'Full name', type:'string', required:true },
    { name:'nameArabic', label:'Arabic name', type:'string', required:true },
    { name:'role', label:'Role line', type:'string', required:true },
    { name:'tagline', label:'Tagline', type:'text' },
    { name:'location', label:'Location', type:'string' },
    { name:'portrait', label:'Hero portrait', type:'object', fields: imageFields },
    { name:'contact', label:'Contact', type:'object', fields:[
      { name:'email', label:'Email', type:'string' },
      { name:'linkedin', label:'LinkedIn', type:'object', fields:[
        { name:'url', label:'URL', type:'string' }, { name:'label', label:'Label', type:'string' } ] },
      { name:'github', label:'GitHub', type:'object', fields:[
        { name:'url', label:'URL', type:'string' }, { name:'label', label:'Label', type:'string' } ] } ] } ] },

  { name:'summary', file:'data/summary.json', label:'Summary', kind:'single', fields:[
    { name:'content', label:'Summary text', type:'text', required:true } ] },

  // `meta` is not read by any module, but it is not dead: test/index-html.test.js
  // pins index.html's description, title, and canonical URL tags to it, which
  // makes it the single source of truth for them. Dropping it here would delete
  // it from the file on the next save and break that pin.
  { name:'settings', file:'data/settings.json', label:'Settings', kind:'single', fields:[
    { name:'cv', label:'CV', type:'object', fields:[
      { name:'path', label:'CV file', type:'image', accept:'.pdf' },
      { name:'downloadName', label:'Download filename', type:'string' } ] },
    { name:'siteTitle', label:'Site title', type:'string', required:true },
    { name:'meta', label:'SEO meta', type:'object', fields:[
      { name:'title', label:'Meta title', type:'string' },
      { name:'description', label:'Meta description', type:'text' },
      { name:'url', label:'Site URL', type:'string' } ] },
    { name:'nav', label:'Navigation', type:'list', fields:[
      { name:'id', label:'Section id', type:'string', required:true },
      { name:'label', label:'Label', type:'string', required:true } ] },
    { name:'sections', label:'Section visibility', type:'object', fields:[
      { name:'about', label:'About', type:'object', fields:[{ name:'enabled', label:'Enabled', type:'boolean' }] },
      { name:'path', label:'The path so far', type:'object', fields:[{ name:'enabled', label:'Enabled', type:'boolean' }] },
      { name:'numbers', label:'By the numbers', type:'object', fields:[{ name:'enabled', label:'Enabled', type:'boolean' }] },
      { name:'work', label:'Selected work', type:'object', fields:[{ name:'enabled', label:'Enabled', type:'boolean' }] },
      { name:'skills', label:'Skills', type:'object', fields:[{ name:'enabled', label:'Enabled', type:'boolean' }] },
      { name:'contact', label:'Contact', type:'object', fields:[{ name:'enabled', label:'Enabled', type:'boolean' }] } ] } ] },

  { name:'education', file:'data/education.json', label:'Education', kind:'list', listKey:'items', itemFields:[
    { name:'id', label:'Id (anchor and timeline key)', type:'string', required:true },
    { name:'institution', label:'Institution', type:'string', required:true },
    { name:'degree', label:'Degree', type:'string' },
    { name:'location', label:'Location', type:'string' },
    logoField,
    { name:'startDate', label:'Start (YYYY-MM)', type:'string' },
    { name:'endDate', label:'End (YYYY-MM)', type:'string' },
    { name:'displayDate', label:'Display date', type:'string' },
    { name:'grade', label:'Grade', type:'string' },
    orderField,
    imagesField,
    { name:'blocks', label:'Blocks', type:'blocks', scope:'education' } ] },

  { name:'experience', file:'data/experience.json', label:'Experience', kind:'list', listKey:'items', itemFields:[
    { name:'company', label:'Company', type:'string', required:true },
    { name:'location', label:'Location', type:'string' },
    logoField,
    { name:'roles', label:'Roles', type:'list', fields:[
      { name:'id', label:'Id (timeline key)', type:'string', required:true },
      { name:'title', label:'Title', type:'string', required:true },
      { name:'startDate', label:'Start (YYYY-MM)', type:'string' },
      { name:'endDate', label:'End (YYYY-MM or Present)', type:'string' },
      { name:'displayDate', label:'Display date', type:'string' },
      orderField,
      { name:'workRef', label:'Selected Work id to link to', type:'string' },
      bulletsField,
      imagesField,
      { name:'blocks', label:'Blocks', type:'blocks', scope:'experience' } ] } ] },

  { name:'projects', file:'data/projects.json', label:'Projects', kind:'list', listKey:'items', itemFields:[
    { name:'id', label:'Id (anchor)', type:'string', required:true },
    { name:'title', label:'Title', type:'string', required:true },
    { name:'org', label:'Organisation', type:'string' },
    { name:'timeline', label:'Show on the timeline', type:'boolean' },
    { name:'startDate', label:'Start (YYYY-MM)', type:'string' },
    { name:'displayDate', label:'Display date', type:'string' },
    orderField,
    tagsField,
    { name:'links', label:'Links', type:'object', fields:[
      { name:'ios', label:'App Store URL', type:'string' },
      { name:'webapp', label:'Web app URL', type:'string' },
      { name:'github', label:'GitHub URL', type:'string' },
      { name:'extra', label:'Extra links', type:'list', fields:[
        { name:'url', label:'URL', type:'string' }, { name:'label', label:'Label', type:'string' } ] } ] },
    imagesField,
    { name:'blocks', label:'Blocks', type:'blocks', scope:'project' } ] },

  { name:'skills', file:'data/skills.json', label:'Skills', kind:'list', listKey:'categories', itemFields:[
    { name:'name', label:'Category name', type:'string', required:true },
    { name:'type', label:'Display type', type:'select', options:[
      {label:'Tags', value:'tags'}, {label:'Simple list', value:'list'}, {label:'Languages', value:'languages'} ] },
    { name:'items', label:'Items', type:'list', fields:[
      { name:'name', label:'Name', type:'string', required:true },
      { name:'level', label:'Level (languages only)', type:'string' } ] } ] }
];

/** Content files the admin deliberately does not manage yet. milestones and
 *  metrics arrived with the editorial revamp and are the first item of the
 *  admin revamp that follows it; blocks-registry is the admin's own schema for
 *  block types, edited by hand. Named here so test/admin-roundtrip.test.js can
 *  tell "deliberately unmanaged" from "someone forgot a collection". */
export const UNMANAGED_DATA_FILES = ['blocks-registry.json', 'metrics.json', 'milestones.json'];

export function getCollection(name) { return COLLECTIONS.find(c => c.name === name); }
