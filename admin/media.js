import { validateImage, sanitizeFilename } from './lib.js';

export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject; r.readAsDataURL(file);
  });
}
export async function pickAndUpload(client, file) {
  const v = validateImage({ type: file.type, size: file.size });
  if (!v.ok) throw new Error(v.error);
  const base64 = await readFileBase64(file);
  const path = 'assets/' + sanitizeFilename(file.name);
  let sha = null; try { const ex = await client.getFile(path); sha = ex.sha; } catch (_) {}
  await client.putBinary(path, base64, sha, 'admin: upload ' + sanitizeFilename(file.name));
  return path;
}
export function attachImageField(inputEl, model, fieldName, client, thumbEl) {
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/*'; picker.style.display='none';
  picker.addEventListener('change', async () => {
    if (!picker.files[0]) return;
    try { const path = await pickAndUpload(client, picker.files[0]); inputEl.value = path; model[fieldName] = path; if (thumbEl){ thumbEl.src = '../'+path; thumbEl.hidden=false; } }
    catch (e) { alert('Upload failed: ' + e.message); }
  });
  return picker;
}
