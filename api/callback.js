// Vercel Serverless Function: OAuth Callback Handler
// This exchanges the auth code for an access token and returns it to Decap CMS

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code parameter');
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send('OAuth not configured');
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
      return res.status(400).send(`OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(400).send('No access token received');
    }

    // Return HTML that posts the token back to Decap CMS using the expected format
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authorizing...</title>
</head>
<body>
  <p>Authorizing with GitHub...</p>
  <script>
    (function() {
      function sendMessage(message) {
        if (window.opener) {
          window.opener.postMessage(message, "*");
        }
      }

      // Decap CMS expects this exact message format
      var data = { token: "${accessToken}", provider: "github" };

      // First, tell the parent we're authorizing
      sendMessage("authorizing:github");

      // Then send the success message with token
      // Decap CMS expects: "authorization:github:success:" followed by JSON
      var successMessage = "authorization:github:success:" + JSON.stringify(data);
      sendMessage(successMessage);

      // Close this window after a short delay
      setTimeout(function() {
        window.close();
      }, 1000);
    })();
  </script>
  <p>If this window doesn't close automatically, you can close it manually.</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);

  } catch (error) {
    console.error('OAuth error:', error);
    return res.status(500).send('OAuth failed: ' + error.message);
  }
}
