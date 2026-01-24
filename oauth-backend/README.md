# Decap CMS OAuth Backend for Railway

This is a lightweight OAuth authentication backend for Decap CMS (formerly Netlify CMS) designed to run on Railway. It provides GitHub OAuth authentication for your static site CMS.

## Features

- ✅ GitHub OAuth 2.0 authentication
- ✅ CORS support for cross-origin requests
- ✅ Token verification endpoint
- ✅ Minimal dependencies
- ✅ Railway-optimized configuration
- ✅ Beautiful authentication success/error pages

## Prerequisites

Before deploying, you need:

1. **GitHub OAuth App**
   - Create one at: https://github.com/settings/developers
   - Note down your Client ID and Client Secret

2. **Railway Account**
   - Sign up at: https://railway.app

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
OAUTH_CALLBACK_URL=http://localhost:3000/callback
SITE_URL=http://localhost:8080
PORT=3000
```

### 3. Run the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 4. Test the Endpoints

**Health Check:**
```bash
curl http://localhost:3000/
```

Expected response:
```json
{
  "status": "ok",
  "message": "Decap CMS OAuth Provider",
  "timestamp": "2024-01-24T12:00:00.000Z",
  "version": "1.0.0"
}
```

## Deploy to Railway

### Option 1: Deploy via Railway Dashboard (Recommended)

1. **Create New Project**
   - Go to: https://railway.app/dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository
   - Choose branch: `claude/oauth-railway-deployment-OyxEW`

2. **Configure Root Directory**
   - In project settings, set:
   - Root Directory: `oauth-backend`

3. **Add Environment Variables**
   - Go to: Variables tab
   - Add the following variables:
     ```
     GITHUB_CLIENT_ID=<your_github_client_id>
     GITHUB_CLIENT_SECRET=<your_github_client_secret>
     OAUTH_CALLBACK_URL=https://your-app.railway.app/callback
     SITE_URL=https://7mxd.github.io
     ```

4. **Generate Domain**
   - Go to: Settings → Generate Domain
   - Copy the generated URL (e.g., `your-app.railway.app`)

5. **Update Environment Variables**
   - Update `OAUTH_CALLBACK_URL` with your Railway domain
   - Redeploy (Railway does this automatically)

6. **Update GitHub OAuth App**
   - Go to: https://github.com/settings/developers
   - Update "Authorization callback URL" to: `https://your-app.railway.app/callback`

### Option 2: Deploy via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Link Project**
   ```bash
   railway link
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set GITHUB_CLIENT_ID=your_client_id
   railway variables set GITHUB_CLIENT_SECRET=your_client_secret
   railway variables set OAUTH_CALLBACK_URL=https://your-app.railway.app/callback
   railway variables set SITE_URL=https://7mxd.github.io
   ```

5. **Deploy**
   ```bash
   railway up
   ```

## API Endpoints

### `GET /`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "message": "Decap CMS OAuth Provider",
  "timestamp": "2024-01-24T12:00:00.000Z",
  "version": "1.0.0"
}
```

### `GET /auth`
Initiates OAuth flow by redirecting to GitHub

**Query Parameters:** None

**Response:** Redirects to GitHub OAuth authorization page

### `GET /callback`
OAuth callback endpoint that receives authorization code from GitHub

**Query Parameters:**
- `code` (string, required): Authorization code from GitHub

**Response:** HTML page with success/error message and postMessage to parent window

### `POST /api/verify`
Verifies GitHub access token

**Request Body:**
```json
{
  "token": "github_access_token"
}
```

**Response:**
```json
{
  "verified": true,
  "user": {
    "login": "username",
    "id": 12345,
    ...
  }
}
```

## Integration with Decap CMS

Update your `admin/config.yml`:

```yaml
backend:
  name: github
  repo: 7mxd/7mxd.github.io
  branch: main
  base_url: https://your-app.railway.app
  auth_endpoint: /auth

site_url: https://7mxd.github.io
```

## Troubleshooting

### Authentication fails with "No code provided"
- **Cause:** OAuth callback didn't receive authorization code
- **Fix:** Verify callback URL in GitHub OAuth app matches Railway URL exactly

### CORS errors in browser console
- **Cause:** Railway backend not allowing your site origin
- **Fix:** Check `SITE_URL` environment variable is set correctly

### "Missing required environment variables" error
- **Cause:** Environment variables not set in Railway
- **Fix:** Add all required variables in Railway dashboard

### Server not starting
- **Cause:** Port configuration issue
- **Fix:** Railway sets `PORT` automatically - don't override it

## Security Considerations

- ✅ Never commit `.env` file to git
- ✅ Use Railway's environment variables for all secrets
- ✅ GitHub OAuth app should only have necessary scopes (`repo`, `user`)
- ✅ CORS is configured to only allow your specific domain
- ✅ Enable branch protection on your main branch

## Monitoring

Monitor your Railway deployment:
- Dashboard: https://railway.app/dashboard
- View logs for authentication events
- Check metrics for usage patterns

## Cost Estimate

Railway Pricing (as of 2024):
- **Hobby Plan**: $5/month
  - 500 hours runtime
  - 8GB RAM
  - 100GB bandwidth

This should be more than sufficient for a personal CMS backend.

## Support

For issues with:
- **This OAuth backend**: Open an issue in this repository
- **Railway deployment**: Check Railway docs at https://docs.railway.app
- **Decap CMS**: Check docs at https://decapcms.org

## License

MIT License - See main repository for details
