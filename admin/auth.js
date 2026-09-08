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

/** Why a message did or did not complete sign-in.
 *
 *  Pulled out as a pure function because the failure it exists to surface —
 *  a message from an origin we are not listening to — is exactly the one the
 *  old code returned silently from, and a silent branch cannot be tested. */
export function classifyAuthMessage(event, expectedOrigin) {
  if (event.origin !== expectedOrigin) {
    return { ok: false, reason: 'wrong-origin', detail: event.origin };
  }
  const d = event.data;
  if (!d || d.type !== 'oauth:success' || d.provider !== 'github') {
    return { ok: false, reason: 'not-oauth', detail: d && d.type };
  }
  if (!d.token) return { ok: false, reason: 'no-token', detail: null };
  return { ok: true, token: d.token };
}

/** Whether a wrong-origin verdict should abort sign-in rather than be ignored.
 *
 *  Any script, browser extension, or embedded frame can postMessage to this
 *  window, so a wrong-origin classification alone is not grounds to fail
 *  loudly — that would turn unrelated noise into a broken sign-in. Only a
 *  message that claims to be our own OAuth success, arriving from the wrong
 *  origin, is the silent failure this task exists to surface. */
export function isFatalAuthFailure(event, result) {
  return result.reason === 'wrong-origin' && !!event.data && event.data.type === 'oauth:success';
}

const MESSAGES = {
  'wrong-origin': (o) => `Sign-in replied from ${o}, which this page does not trust. `
    + 'The OAuth callback and the site must be on the same origin.',
  'not-oauth': () => 'Sign-in returned an unexpected message.',
  'no-token': () => 'Sign-in succeeded but returned no token.',
};

export function signIn() {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${OAUTH_BASE}/auth`, 'oauth', 'width=600,height=700');
    if (!popup) return reject(new Error('Popup blocked'));
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        window.removeEventListener('message', onMessage);
        reject(new Error('Sign-in cancelled'));
      }
    }, 500);
    function onMessage(e) {
      const r = classifyAuthMessage(e, OAUTH_BASE);
      if (!r.ok) {
        // A message from a wrong origin used to return silently here, which is
        // why a broken deploy looked identical to the user closing the popup.
        // But any script, extension, or frame can postMessage to this window,
        // so only a message claiming to be our own OAuth success is worth
        // failing sign-in over — everything else is ignored, as before.
        if (!isFatalAuthFailure(e, r)) return;
        clearInterval(poll);
        window.removeEventListener('message', onMessage);
        popup.close();
        reject(new Error(MESSAGES[r.reason](r.detail)));
        return;
      }
      clearInterval(poll);
      window.removeEventListener('message', onMessage);
      setToken(r.token);
      resolve(r.token);
    }
    window.addEventListener('message', onMessage);
  });
}
