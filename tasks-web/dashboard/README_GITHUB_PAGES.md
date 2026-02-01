# Deploy: GitHub Pages

This dashboard is a **static** site. It does NOT embed secrets.

At runtime, the user enters:
- API base (example: `http://100.122.77.97:8787`)
- token

Those values are stored in browser localStorage.

## GitHub Pages setup

1. Create a GitHub repo containing this workspace (or at least `tasks-web/dashboard`).
2. Ensure the default branch is `main`.
3. In GitHub repo settings:
   - Settings → Pages → Source: **GitHub Actions**
4. Push to `main`.

The workflow file:
- `.github/workflows/deploy-pages.yml`

will build and deploy automatically.

## Use it

Open your GitHub Pages URL, then enter:
- API base: `http://100.122.77.97:8787` (requires the viewing device to be on your Tailscale tailnet)
- token: the dashboard token configured on the status-service.

