# CUDMAZE deployment (Cloudflare Pages)

Hosting: your existing Cloudflare Pages project, deployed from GitHub (push to `main`).

## Pages build settings
- Framework preset: None
- Build command: *(leave empty)*
- Build output directory: `/` (repository root)
- The `functions/` folder is picked up automatically and serves `/api/*`.

## One-time setup for accounts + saved carts (Cloudflare D1)
Without this the shop still works: guests browse and order on WhatsApp, and sign-in shows "Accounts are not available right now".

1. Cloudflare dashboard -> **Storage & databases** -> **D1 SQL database** -> **Create database**. Name: `cudmaze-db`.
2. Open the database -> **Console** tab. Paste the whole contents of `schema.sql` and run it.
3. **Workers & Pages** -> your CUDMAZE Pages project -> **Settings** -> **Bindings** -> **Add** -> **D1 database**.
   - Variable name: `DB` (exactly, capital letters)
   - D1 database: `cudmaze-db`
   - Add it for **Production** (and **Preview** if you use preview deploys).
4. **Deployments** -> redeploy the latest deployment (or push any small commit). Bindings only apply to new deployments.

There are no secrets or environment variables to set. Do not add a `wrangler.jsonc` unless it lists this D1 binding with the real database id, because Pages then manages bindings from that file instead of the dashboard.

Local test (optional): `npx wrangler pages dev .` with a D1 binding named `DB`.

## Editing content
Everything in the shop is plain HTML in `index.html` (Shop tab, `#serviceList`). Product prices / variations / photos: edit the row, e.g.
`<div class="list-item" data-price="15000" data-variations="Size:S|M|L;Colour:Red|Blue" data-image="img/products/x.webp">`
Each row's `data-price`, `data-was` (old price for a sale), `data-variations`, `data-image`, `data-kind="service"` and `data-from="1"` ("From ₦...") control the card and the product modal.
WhatsApp number: `WA_NUMBER` at the top of `js/market.js`.
Sample sellers, prices, reviews, delivery fees and policies are PLACEHOLDERS: replace them with your real details before launch.

## Theme
Dark green glass theme (default) with a soft sage light mode (toggle in the header). All colours are CSS variables at the end of `css/styles.css` ("THEME: GLASS LEAF").
