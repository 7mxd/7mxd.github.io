// Vercel Serverless Function: OAuth Callback Handler
// This exchanges the auth code for an access token and returns it to Decap CMS

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const siteUrl = process.env.SITE_URL || 'https://7mxd.github.io';

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'OAuth credentials not configured' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    const accessToken = tokenData.access_token;

    // Fetch user info to verify the token works
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Failed to verify token' });
    }

    // Return HTML that posts the token back to Decap CMS
    // This is the standard flow that Decap CMS expects
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OAuth Callback</title>
</head>
<body>
  <script>
    (function() {
      function receiveMessage(e) {
        console.log("receiveMessage %o", e);
        if (e.data === "authorizing:github") {
          window.opener.postMessage(
            "authorization:github:success:${JSON.stringify({ token: accessToken, provider: 'github' })}",
            e.origin
          );
          window.close();
        }
      }
      window.addEventListener("message", receiveMessage, false);
      window.opener.postMessage("authorizing:github", "${siteUrl}");
    })();
  </script>
  <p>Authenticating with GitHub...</p>
  <p>If this window doesn't close automatically, please close it and try again.</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);

  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'OAuth exchange failed' });
  }
}
