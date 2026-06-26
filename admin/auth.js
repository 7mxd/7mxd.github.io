const KEY = 'gh_token';
const OAUTH_BASE = 'https://7mxd-oauth.vercel.app';

export function getToken() {
  return sessionStorage.getItem(KEY);
}

export function setToken(t) {
  sessionStorage.setItem(KEY, t);
}

export function signOut() {
  sessionStorage.removeItem(KEY);
}

export function signIn() {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${OAUTH_BASE}/auth`, 'oauth', 'width=600,height=700');
    if (!popup) return reject(new Error('Popup blocked'));
    function onMessage(e) {
      if (e.origin !== OAUTH_BASE) return;
      const d = e.data;
      if (d && d.type === 'oauth:success' && d.token) {
        window.removeEventListener('message', onMessage);
        setToken(d.token);
        resolve(d.token);
      }
    }
    window.addEventListener('message', onMessage);
  });
}
