function fieldEl(field, model, ctx) {
  const wrap = document.createElement('div'); wrap.className = 'field';
  const id = 'f_' + Math.random().toString(36).slice(2);
  if (field.type === 'object') {
    const fs = document.createElement('fieldset'); const lg = document.createElement('legend'); lg.textContent = field.label; fs.appendChild(lg);
    model[field.name] = model[field.name] || {};
    field.fields.forEach(sub => fs.appendChild(fieldEl(sub, model[field.name], ctx)));
    return fs;
  }
  if (field.type === 'list') { return listEl(field, model, ctx); }
  if (field.type === 'blocks') {
    const fs = document.createElement('fieldset'); const lg=document.createElement('legend'); lg.textContent=field.label; fs.appendChild(lg);
    const host = document.createElement('div'); fs.appendChild(host);
    model[field.name] = Array.isArray(model[field.name]) ? model[field.name] : [];
    ctx.renderBlocks(host, model[field.name], field.scope, ctx.registry, ctx);
    return fs;
  }
  const lab = document.createElement('label'); lab.textContent = field.label + (field.required?' *':''); lab.htmlFor = id; wrap.appendChild(lab);
  let input;
  if (field.type === 'text') { input = document.createElement('textarea'); }
  else if (field.type === 'boolean') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!model[field.name]; }
  else if (field.type === 'select') { input = document.createElement('select'); input.innerHTML = field.options.map(o=>`<option value="${o.value}">${o.label}</option>`).join(''); input.value = model[field.name] ?? ''; }
  else { input = document.createElement('input'); input.type = 'text'; }
  input.id = id;
  if (field.type !== 'boolean' && field.type !== 'select') input.value = model[field.name] ?? '';
  const evt = field.type === 'boolean' ? 'change' : 'input';
  input.addEventListener(evt, () => { model[field.name] = field.type==='boolean'? input.checked : input.value; });
  wrap.appendChild(input);
  if (field.type === 'image') {
    const thumb = document.createElement('img'); thumb.className='thumb'; thumb.hidden = !model[field.name]; if (model[field.name]) thumb.src = '../'+model[field.name];
    const btn = document.createElement('button'); btn.type='button'; btn.className='btn ghost'; btn.textContent='Upload image';
    const picker = ctx.attachImageField(input, model, field.name, ctx.client, thumb);
    btn.onclick = () => picker.click();
    wrap.append(btn, picker, thumb);
  }
  return wrap;
}
function listEl(field, model, ctx) {
  const fs = document.createElement('fieldset'); const lg=document.createElement('legend'); lg.textContent=field.label; fs.appendChild(lg);
  model[field.name] = Array.isArray(model[field.name]) ? model[field.name] : [];
  const host = document.createElement('div');
  const rerender = () => {
    host.innerHTML = '';
    model[field.name].forEach((item, i) => {
      const box = document.createElement('div'); box.className='list-item';
      const ctrls = document.createElement('div'); ctrls.className='row-controls';
      const mk=(t,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=t;b.onclick=()=>{fn();rerender();host.dispatchEvent(new Event('input',{bubbles:true}));};return b;};
      ctrls.append(mk('↑',()=>{if(i>0)[model[field.name][i-1],model[field.name][i]]=[model[field.name][i],model[field.name][i-1]];}),
                   mk('↓',()=>{if(i<model[field.name].length-1)[model[field.name][i+1],model[field.name][i]]=[model[field.name][i],model[field.name][i+1]];}),
                   mk('Remove',()=>model[field.name].splice(i,1)));
      box.appendChild(ctrls);
      if (field.itemField) { // primitive list (tags)
        const inp=document.createElement('input'); inp.type='text'; inp.value=item??''; inp.addEventListener('input',()=>model[field.name][i]=inp.value); box.appendChild(inp);
      } else {
        field.fields.forEach(sub => box.appendChild(fieldEl(sub, item, ctx)));
      }
      host.appendChild(box);
    });
  };
  rerender();
  const add = document.createElement('button'); add.type='button'; add.className='btn'; add.textContent='+ Add';
  add.onclick = () => { model[field.name].push(field.itemField ? '' : {}); rerender(); host.dispatchEvent(new Event('input', { bubbles: true })); };
  fs.append(host, add);
  return fs;
}
export function renderForm(container, collection, model, ctx) {
  container.innerHTML = '';
  if (collection.kind === 'single') collection.fields.forEach(f => container.appendChild(fieldEl(f, model, ctx)));
  else container.appendChild(listEl({ name: collection.listKey, label: collection.label, type:'list', fields: collection.itemFields }, model, ctx));
}
