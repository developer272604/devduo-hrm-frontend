# Frontend styling

All application styling uses locally compiled Tailwind CSS utilities. `src/tailwind.css` contains only Tailwind's package import, dark-mode variant, and brand palette configuration. Do not add custom CSS rules, remote stylesheets, React `style` props, or JavaScript style mutations.

- Primary brand: **#7c46f1** (`brand-500`). Related shades provide readable text, hover states, selected options and dark surfaces.
- Light and dark mode: the sun/moon button is available on login and in the application header. Preference persists in this browser; the initial default follows the system theme.
- Every single-choice form dropdown uses `components/Select.jsx`, with a shared options panel, selected indicator, Arrow/Home/End navigation, type-ahead, Enter selection, Escape dismissal and native form validation.
- Use `dark:` variants on components, including dialog portals and menus. Use system fonts; external font CSS is not loaded.
- The CSS file emitted by Vite is generated from Tailwind, not a hand-authored external stylesheet.

Login: http://127.0.0.1:5173 — workspace `devduo`, email `admin@devduo.test`, local demo password `DevduoDemo2026!`.

Phase 2 and Phase 3 briefs are preserved under `../docs`. Those modules are not implemented by the styling update.

Validation: production build passed, 9 component tests passed, and all 12 browser checks passed (three cold-start timeouts passed on rerun). Coverage includes exact brand color, theme persistence, keyboard dropdown selection, nested dialog Escape behavior, no inline style attributes, no remote stylesheets, login and responsive navigation. Preview screenshots are in `../docs/screenshots/settings-dark.png` and `../docs/screenshots/dropdown-light.png`.
"# devduo-hrm-frontend" 
"# devduo-hrm-frontend" 
"# devduo-hrm-frontend" 
"# devduo-hrm-frontend"

## Connecting the API (Cloudflare Pages)

The app calls `/api/*` on its own origin. A static host has no API there, so the site shows "Cannot reach the Devduo API" until a backend is connected:

1. Host the Laravel backend somewhere publicly reachable over HTTPS (PHP 8.2+, MySQL/MariaDB, queue worker and scheduler running). `APP_URL`, `SESSION_DOMAIN=null`, `SESSION_SECURE_COOKIE=true` and `SESSION_SAME_SIDE=lax` should match the deployed setup; run `php artisan migrate --force`.
2. In Cloudflare Pages > Settings > Variables, set `API_ORIGIN` to that backend URL (no trailing slash). `functions/api/[[path]].js` proxies `/api/*` to it, keeping browser requests same-origin so cookies and CSRF work.
3. Redeploy. For local work keep using `npm run dev` (Vite proxies `/api` to `http://127.0.0.1:8000`).
