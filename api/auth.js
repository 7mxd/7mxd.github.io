// Vercel Serverless Function: OAuth Authorization Redirect
// This initiates the GitHub OAuth flow for Decap CMS

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.OAUTH_CALLBACK_URL;

  if (!clientId) {
    return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
  }

  // Scopes needed for Decap CMS to read/write repo content
  const scope = 'repo,user';

  // Build GitHub OAuth authorization URL
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  // Redirect to GitHub for authorization
  res.redirect(302, authUrl);
}
