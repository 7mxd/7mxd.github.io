import { blockTypesForScope, fieldsForBlock, newBlock } from './blocks-model.js';
import { renderField, moveItem } from './fields.js';

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
    mk('↑', () => moveItem(blocks, i, i - 1)),
    mk('↓', () => moveItem(blocks, i, i + 1)),
    mk('Remove', () => blocks.splice(i, 1)) );
  wrap.appendChild(ctrls);
  for (const f of fieldsForBlock(registry, block.type)) {
    wrap.appendChild(renderField(document, f, block, ctx));
  }
  return wrap;
}
