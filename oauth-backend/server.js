const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: [
    'https://7mxd.github.io',
    'http://localhost:1313',
    'http://localhost:8080',
    process.env.SITE_URL
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL;

// Validate required environment variables
if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !OAUTH_CALLBACK_URL) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, OAUTH_CALLBACK_URL');
  process.exit(1);
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Decap CMS OAuth Provider',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// OAuth initiation endpoint
app.get('/auth', (req, res) => {
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo,user&redirect_uri=${OAUTH_CALLBACK_URL}`;
  console.log('Redirecting to GitHub OAuth:', authUrl);
  res.redirect(authUrl);
});

// OAuth callback endpoint
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    console.error('No authorization code provided');
    return res.status(400).send('No code provided');
  }

  try {
    console.log('Exchanging code for access token...');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: OAUTH_CALLBACK_URL
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    const { access_token, token_type } = tokenResponse.data;

    if (!access_token) {
      console.error('No access token received from GitHub');
      throw new Error('No access token received');
    }

    console.log('Access token received, fetching user info...');

    // Get user info to verify authentication
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `${token_type} ${access_token}`
      }
    });

    console.log(`User authenticated: ${userResponse.data.login}`);

    // Return success page with token
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #333;
            margin-bottom: 1rem;
            font-size: 1.5rem;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
          .success {
            color: #10b981;
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: scaleIn 0.5s ease;
          }
          strong {
            color: #667eea;
          }
          @keyframes scaleIn {
            from {
              transform: scale(0);
            }
            to {
              transform: scale(1);
            }
          }
        </style>
        <script>
          (function() {
            if (window.opener) {
              const data = {
                token: '${access_token}',
                provider: 'github'
              };
              window.opener.postMessage(
                'authorization:github:success:' + JSON.stringify(data),
                'https://7mxd.github.io'
              );
              setTimeout(function() { window.close(); }, 1000);
            }
          })();
        </script>
      </head>
      <body>
        <div class="container">
          <div class="success">✓</div>
          <h1>Authentication Successful!</h1>
          <p>You have been authenticated as <strong>${userResponse.data.login}</strong></p>
          <p>This window will close automatically...</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f3f4f6;
          }
          .container {
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #dc2626;
            margin-bottom: 1rem;
            font-size: 1.5rem;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
          .error {
            color: #dc2626;
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .error-details {
            background: #fee2e2;
            padding: 1rem;
            border-radius: 6px;
            margin-top: 1rem;
            font-size: 0.875rem;
            color: #991b1b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">✗</div>
          <h1>Authentication Failed</h1>
          <p>There was an error during authentication.</p>
          <div class="error-details">
            ${error.message}
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Token verification endpoint (for Decap CMS)
app.post('/api/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    res.json({
      verified: true,
      user: response.data
    });
  } catch (error) {
    console.error('Token verification error:', error.response?.data || error.message);
    res.status(401).json({
      verified: false,
      error: 'Invalid token'
    });
  }
});

// Success endpoint (alternative for some OAuth flows)
app.get('/success', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('No token provided');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Successful</title>
      <meta charset="utf-8">
      <script>
        (function() {
          if (window.opener) {
            const data = {
              token: '${token}',
              provider: 'github'
            };
            window.opener.postMessage(
              'authorization:github:success:' + JSON.stringify(data),
              'https://7mxd.github.io'
            );
            window.close();
          }
        })();
      </script>
    </head>
    <body>
      <p>Authentication successful. You can close this window.</p>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Decap CMS OAuth Backend Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔗 Callback URL: ${OAUTH_CALLBACK_URL}`);
  console.log(`🌐 Site URL: ${process.env.SITE_URL || 'https://7mxd.github.io'}`);
  console.log(`✅ GitHub Client ID: ${GITHUB_CLIENT_ID ? '***' + GITHUB_CLIENT_ID.slice(-4) : 'NOT SET'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
