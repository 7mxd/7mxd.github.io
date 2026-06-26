import { toBase64, fromBase64 } from './lib.js';

const REPO = '7mxd/7mxd.github.io';
export function contentsUrl(path) { return `https://api.github.com/repos/${REPO}/contents/${path}`; }
export function decodeFile(resp) { return { content: fromBase64(resp.content), sha: resp.sha }; }
export function putBody({ message, contentString, sha, branch = 'main' }) {
  const body = { message, content: toBase64(contentString), branch };
  if (sha) body.sha = sha;
  return body;
}

export function createClient({ token, fetchFn = fetch }) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  async function getFile(path) {
    const res = await fetchFn(contentsUrl(path), { headers });
    if (res.status === 404) return { content: null, sha: null };
    if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
    return decodeFile(await res.json());
  }
  async function put(path, body) {
    const res = await fetchFn(contentsUrl(path), { method:'PUT', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if (res.status === 409 || res.status === 422) { const e = new Error('conflict'); e.conflict = true; throw e; }
    if (res.status === 403) { const e = new Error('no write access'); e.forbidden = true; throw e; }
    if (!res.ok) throw new Error(`PUT ${path} failed (${res.status})`);
    return res.json();
  }
  function putFile(path, contentString, sha, message) { return put(path, putBody({ message, contentString, sha })); }
  function putBinary(path, base64, sha, message) {
    const body = { message, content: base64.replace(/\s/g,''), branch:'main' }; if (sha) body.sha = sha;
    return put(path, body);
  }
  return { getFile, putFile, putBinary };
}
