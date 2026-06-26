import { blockTypesForScope, fieldsForBlock, newBlock } from './blocks-model.js';

export function renderBlocks(container, blocks, scope, registry, ctx) {
  container.innerHTML = '';
  const list = document.createElement('div');
  blocks.forEach((block, i) => list.appendChild(blockItem(blocks, i, scope, registry, () => renderBlocks(container, blocks, scope, registry, ctx), ctx)));
  container.appendChild(list);
  const add = document.createElement('select');
  add.innerHTML = `<option value="">+ Add block…</option>` +
    blockTypesForScope(registry, scope).map(t => `<option value="${t.type}">${t.label}</option>`).join('');
  add.addEventListener('change', () => {
    if (add.value) {
      blocks.push(newBlock(registry, add.value));
      renderBlocks(container, blocks, scope, registry, ctx);
      container.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  container.appendChild(add);
}
function blockItem(blocks, i, scope, registry, rerender, ctx) {
  const block = blocks[i];
  const wrap = document.createElement('div'); wrap.className = 'list-item';
  const ctrls = document.createElement('div'); ctrls.className = 'row-controls';
  const typeLabel = document.createElement('strong'); typeLabel.textContent = block.type;
  ctrls.appendChild(typeLabel);
  const mk = (label, fn) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = label;
    b.onclick = () => { fn(); rerender(); ctrls.dispatchEvent(new Event('input', { bubbles: true })); };
    return b;
  };
  ctrls.append(
    mk('↑', () => { if (i > 0) [blocks[i-1], blocks[i]] = [blocks[i], blocks[i-1]]; }),
    mk('↓', () => { if (i < blocks.length-1) [blocks[i+1], blocks[i]] = [blocks[i], blocks[i+1]]; }),
    mk('Remove', () => blocks.splice(i, 1)) );
  wrap.appendChild(ctrls);
  for (const f of fieldsForBlock(registry, block.type)) {
    const field = document.createElement('div'); field.className = 'field';
    const lab = document.createElement('label'); lab.textContent = f.label || f.name; field.appendChild(lab);
    if (f.type === 'list') {
      const ta = document.createElement('textarea'); ta.value = (block[f.name] || []).join('\n');
      ta.addEventListener('input', () => block[f.name] = ta.value.split('\n').filter(Boolean));
      field.appendChild(ta);
    } else if (f.type === 'code' || f.type === 'text') {
      const ta = document.createElement('textarea'); ta.value = block[f.name] || '';
      ta.addEventListener('input', () => block[f.name] = ta.value); field.appendChild(ta);
    } else if (f.type === 'select' && Array.isArray(f.options)) {
      const sel = document.createElement('select');
      sel.innerHTML = f.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      sel.value = block[f.name] || '';
      sel.addEventListener('change', () => { block[f.name] = sel.value; });
      field.appendChild(sel);
    } else if (f.type === 'image') {
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = block[f.name] || '';
      inp.addEventListener('input', () => { block[f.name] = inp.value; });
      field.appendChild(inp);
      if (ctx && ctx.client && ctx.attachImageField) {
        const thumb = document.createElement('img'); thumb.className = 'thumb'; thumb.hidden = !block[f.name]; if (block[f.name]) thumb.src = '../' + block[f.name];
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn ghost'; btn.textContent = 'Upload image';
        const picker = ctx.attachImageField(inp, block, f.name, ctx.client, thumb);
        btn.onclick = () => picker.click();
        field.append(btn, picker, thumb);
      }
    } else {
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = block[f.name] || '';
      inp.addEventListener('input', () => block[f.name] = inp.value); field.appendChild(inp);
    }
    wrap.appendChild(field);
  }
  return wrap;
}
