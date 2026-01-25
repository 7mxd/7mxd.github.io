# Personal Portfolio Website

A personal portfolio website hosted on GitHub Pages with a CMS admin panel for easy content editing.

## Live Site

- **Portfolio**: [https://7mxd.github.io](https://7mxd.github.io)
- **Admin Panel**: [https://7mxd.github.io/admin](https://7mxd.github.io/admin)

## Architecture

```
GitHub Pages (7mxd.github.io)          Vercel Serverless
┌────────────────────────┐             ┌─────────────────┐
│  Static Portfolio      │             │  OAuth Backend  │
│  - HTML/CSS/JS         │◄───────────►│  /api/auth      │
│  - /data/*.json        │             │  /api/callback  │
│  - /admin (Decap CMS)  │             └─────────────────┘
└────────────────────────┘                     │
                                               ▼
                                        GitHub OAuth API
```

- **Static Site**: Hosted on GitHub Pages (free)
- **CMS**: Decap CMS (formerly Netlify CMS) - edits content via GitHub commits
- **OAuth Backend**: Vercel Serverless Functions (free tier)
- **Content Storage**: JSON files in `/data/` directory

## Content Structure

All content is stored as JSON files that can be edited through the admin panel:

| File | Description |
|------|-------------|
| `data/profile.json` | Name, title, photo, contact info |
| `data/summary.json` | Professional summary |
| `data/education.json` | Education history |
| `data/experience.json` | Work experience |
| `data/skills.json` | Skills by category |
| `data/settings.json` | Site settings, CV file, SEO metadata |

## Deploy + Setup

### Prerequisites

- GitHub account (owner of this repo)
- Vercel account (free tier)

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** > **New OAuth App**
3. Fill in the form:
   - **Application name**: `7mxd Portfolio CMS`
   - **Homepage URL**: `https://7mxd.github.io`
   - **Authorization callback URL**: `https://YOUR-VERCEL-PROJECT.vercel.app/callback`
     (Replace with your actual Vercel URL after deployment)
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it immediately

### Step 2: Deploy OAuth Backend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** > **Project**
3. Import the `7mxd/7mxd.github.io` repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as default)
5. Add Environment Variables:

   | Name | Value |
   |------|-------|
   | `GITHUB_CLIENT_ID` | Your GitHub OAuth Client ID |
   | `GITHUB_CLIENT_SECRET` | Your GitHub OAuth Client Secret |
   | `OAUTH_CALLBACK_URL` | `https://YOUR-PROJECT.vercel.app/callback` |
   | `SITE_URL` | `https://7mxd.github.io` |

6. Click **Deploy**
7. Note your Vercel deployment URL (e.g., `https://7mxd-oauth.vercel.app`)

### Step 3: Update Configuration

1. Update `admin/config.yml`:
   - Change `base_url` to your Vercel deployment URL

2. Update GitHub OAuth App:
   - Go back to your GitHub OAuth App settings
   - Update the **Authorization callback URL** to: `https://YOUR-VERCEL-PROJECT.vercel.app/callback`

3. Commit and push the changes:
   ```bash
   git add admin/config.yml
   git commit -m "Update OAuth backend URL"
   git push origin main
   ```

### Step 4: Enable GitHub Pages (if not already)

1. Go to your repo **Settings** > **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Click **Save**

## Using the Admin Panel

1. Go to [https://7mxd.github.io/admin](https://7mxd.github.io/admin)
2. Click **Login with GitHub**
3. Authorize the OAuth app
4. Edit your content using the visual editor
5. Click **Publish** to commit changes directly to the repo

Changes are automatically deployed to GitHub Pages within seconds.

## Local Development

No build process required - this is a pure static site.

```bash
# Clone the repo
git clone https://github.com/7mxd/7mxd.github.io.git
cd 7mxd.github.io

# Serve locally (any static server works)
npx serve .
# or
python -m http.server 8000
```

## File Structure

```
7mxd.github.io/
├── index.html          # Main portfolio page
├── style.css           # Styles (with dark mode support)
├── script.js           # Dynamic content rendering
├── admin/
│   ├── index.html      # Decap CMS loader
│   └── config.yml      # CMS configuration
├── api/
│   ├── auth.js         # OAuth initiation (Vercel function)
│   └── callback.js     # OAuth callback (Vercel function)
├── data/
│   ├── profile.json
│   ├── summary.json
│   ├── education.json
│   ├── experience.json
│   ├── skills.json
│   └── settings.json
├── assets/             # Images and files
├── vercel.json         # Vercel configuration
└── README.md
```

## Troubleshooting

### "Login failed" in admin panel
- Verify your GitHub OAuth App callback URL matches your Vercel URL exactly
- Check Vercel environment variables are set correctly
- Ensure you're logged into GitHub in your browser

### Changes not appearing on site
- GitHub Pages may take 1-2 minutes to deploy
- Hard refresh your browser (Ctrl+Shift+R)
- Check the repo to confirm the commit was made

### OAuth errors
- Check Vercel function logs in your Vercel dashboard
- Verify the `SITE_URL` environment variable is correct

## License

This repository is for personal use and is not intended for redistribution.
