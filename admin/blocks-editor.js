import { blockTypesForScope, fieldsForBlock, newBlock } from './blocks-model.js';

export function renderBlocks(container, blocks, scope, registry) {
  container.innerHTML = '';
  const list = document.createElement('div');
  blocks.forEach((block, i) => list.appendChild(blockItem(blocks, i, scope, registry, () => renderBlocks(container, blocks, scope, registry))));
  container.appendChild(list);
  const add = document.createElement('select');
  add.innerHTML = `<option value="">+ Add block…</option>` +
    blockTypesForScope(registry, scope).map(t => `<option value="${t.type}">${t.label}</option>`).join('');
  add.addEventListener('change', () => { if (add.value) { blocks.push(newBlock(registry, add.value)); renderBlocks(container, blocks, scope, registry); } });
  container.appendChild(add);
}
function blockItem(blocks, i, scope, registry, rerender) {
  const block = blocks[i];
  const wrap = document.createElement('div'); wrap.className = 'list-item';
  const ctrls = document.createElement('div'); ctrls.className = 'row-controls';
  ctrls.innerHTML = `<strong>${block.type}</strong>`;
  const mk = (label, fn) => { const b=document.createElement('button'); b.type='button'; b.className='btn ghost'; b.textContent=label; b.onclick=()=>{fn();rerender();}; return b; };
  ctrls.append(
    mk('↑', () => { if (i>0) [blocks[i-1],blocks[i]]=[blocks[i],blocks[i-1]]; }),
    mk('↓', () => { if (i<blocks.length-1) [blocks[i+1],blocks[i]]=[blocks[i],blocks[i+1]]; }),
    mk('Remove', () => blocks.splice(i,1)) );
  wrap.appendChild(ctrls);
  for (const f of fieldsForBlock(registry, block.type)) {
    const field = document.createElement('div'); field.className='field';
    const lab = document.createElement('label'); lab.textContent = f.label || f.name; field.appendChild(lab);
    if (f.type === 'list') {
      const ta = document.createElement('textarea'); ta.value = (block[f.name]||[]).join('\n');
      ta.addEventListener('input', () => block[f.name] = ta.value.split('\n').filter(Boolean));
      field.appendChild(ta);
    } else if (f.type === 'code' || f.type === 'text') {
      const ta = document.createElement('textarea'); ta.value = block[f.name]||'';
      ta.addEventListener('input', () => block[f.name] = ta.value); field.appendChild(ta);
    } else {
      const inp = document.createElement('input'); inp.type='text'; inp.value = block[f.name]||'';
      inp.addEventListener('input', () => block[f.name] = inp.value); field.appendChild(inp);
    }
    wrap.appendChild(field);
  }
  return wrap;
}
