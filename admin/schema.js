const clusterField = { name:'cluster', label:'Cluster', type:'select', options:[
  {label:'Mathematics', value:'math'}, {label:'Data Science', value:'data'}, {label:'Engineering & Products', value:'engineering'} ] };
const tagsField = { name:'tags', label:'Tags', type:'list', itemField:{ name:'tag', label:'Tag', type:'string' } };

export const COLLECTIONS = [
  { name:'profile', file:'data/profile.json', label:'Profile', kind:'single', fields:[
    { name:'name', label:'Full name', type:'string', required:true },
    { name:'title', label:'Title', type:'string', required:true },
    { name:'contact', label:'Contact', type:'object', fields:[
      { name:'email', label:'Email', type:'string' },
      { name:'phone', label:'Phone', type:'string' },
      { name:'location', label:'Location', type:'string' },
      { name:'linkedin', label:'LinkedIn', type:'object', fields:[
        { name:'url', label:'URL', type:'string' }, { name:'label', label:'Label', type:'string' } ] },
      { name:'github', label:'GitHub', type:'object', fields:[
        { name:'url', label:'URL', type:'string' }, { name:'label', label:'Label', type:'string' } ] } ] } ] },

  { name:'summary', file:'data/summary.json', label:'Summary', kind:'single', fields:[
    { name:'content', label:'Summary text', type:'text', required:true } ] },

  { name:'settings', file:'data/settings.json', label:'Settings', kind:'single', fields:[
    { name:'siteTitle', label:'Site title', type:'string' },
    { name:'navLogo', label:'Nav logo text', type:'string' },
    { name:'theme', label:'Default theme', type:'select', options:[
      {label:'Auto', value:'auto'}, {label:'Light', value:'light'}, {label:'Dark', value:'dark'} ] },
    { name:'cv', label:'CV', type:'object', fields:[
      { name:'path', label:'CV file', type:'image', accept:'.pdf' }, { name:'downloadName', label:'Download filename', type:'string' } ] },
    { name:'meta', label:'SEO meta', type:'object', fields:[
      { name:'title', label:'Meta title', type:'string' }, { name:'description', label:'Meta description', type:'text' },
      { name:'keywords', label:'Keywords', type:'string' }, { name:'url', label:'Site URL', type:'string' } ] },
    { name:'graph', label:'Graph', type:'object', fields:[
      { name:'clusters', label:'Clusters', type:'object', fields:[
        { name:'math', label:'Mathematics', type:'object', fields:[ {name:'label',label:'Label',type:'string'}, {name:'color',label:'Color',type:'string'} ] },
        { name:'data', label:'Data Science', type:'object', fields:[ {name:'label',label:'Label',type:'string'}, {name:'color',label:'Color',type:'string'} ] },
        { name:'engineering', label:'Engineering', type:'object', fields:[ {name:'label',label:'Label',type:'string'}, {name:'color',label:'Color',type:'string'} ] } ] } ] } ] },

  { name:'education', file:'data/education.json', label:'Education', kind:'list', listKey:'items', itemFields:[
    { name:'institution', label:'Institution', type:'string', required:true },
    { name:'logo', label:'Logo', type:'image' },
    { name:'degree', label:'Degree', type:'string' },
    { name:'startDate', label:'Start (YYYY-MM)', type:'string' },
    { name:'endDate', label:'End (YYYY-MM)', type:'string' },
    { name:'displayDate', label:'Display date', type:'string' },
    { name:'grade', label:'Grade', type:'string' },
    clusterField,
    { name:'blocks', label:'Blocks', type:'blocks', scope:'education' } ] },

  { name:'experience', file:'data/experience.json', label:'Experience', kind:'list', listKey:'items', itemFields:[
    { name:'company', label:'Company', type:'string', required:true },
    { name:'logo', label:'Logo', type:'object', fields:[
      { name:'default', label:'Default', type:'image' }, { name:'light', label:'Light', type:'image' }, { name:'dark', label:'Dark', type:'image' } ] },
    { name:'location', label:'Location', type:'string' },
    clusterField, tagsField,
    { name:'roles', label:'Roles', type:'list', fields:[
      { name:'title', label:'Title', type:'string', required:true },
      { name:'startDate', label:'Start (YYYY-MM)', type:'string' },
      { name:'endDate', label:'End (YYYY-MM or Present)', type:'string' },
      { name:'displayDate', label:'Display date', type:'string' },
      { name:'blocks', label:'Blocks', type:'blocks', scope:'experience' } ] } ] },

  { name:'projects', file:'data/projects.json', label:'Projects', kind:'list', listKey:'items', itemFields:[
    { name:'title', label:'Title', type:'string', required:true },
    { name:'status', label:'Status', type:'select', options:[
      {label:'(none)', value:''}, {label:'in progress', value:'in-progress'}, {label:'shipped', value:'shipped'},
      {label:'research', value:'research'}, {label:'archived', value:'archived'} ] },
    clusterField, tagsField,
    { name:'image', label:'Image', type:'image' },
    { name:'links', label:'Links', type:'object', fields:[
      { name:'github', label:'GitHub URL', type:'string' }, { name:'webapp', label:'Web app URL', type:'string' },
      { name:'ios', label:'iOS URL', type:'string' }, { name:'android', label:'Android URL', type:'string' },
      { name:'extra', label:'Extra links', type:'list', fields:[
        { name:'label', label:'Label', type:'string' }, { name:'url', label:'URL', type:'string' } ] } ] },
    { name:'blocks', label:'Blocks', type:'blocks', scope:'project' } ] },

  { name:'skills', file:'data/skills.json', label:'Skills', kind:'list', listKey:'categories', itemFields:[
    { name:'name', label:'Category name', type:'string', required:true },
    { name:'type', label:'Display type', type:'select', options:[
      {label:'Tags', value:'tags'}, {label:'Simple list', value:'list'}, {label:'Languages', value:'languages'} ] },
    { name:'items', label:'Items', type:'list', fields:[
      { name:'name', label:'Name', type:'string', required:true },
      { name:'level', label:'Level (languages only)', type:'string' } ] } ] }
];

export function getCollection(name) { return COLLECTIONS.find(c => c.name === name); }
