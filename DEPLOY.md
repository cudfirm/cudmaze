# CUDMAZE deployment (one-time setup for accounts + saved carts)

1. `npm i -D wrangler`
2. `npx wrangler d1 create cudmaze-db`  -> copy the printed `database_id` into `wrangler.jsonc`
3. `npx wrangler d1 execute cudmaze-db --remote --file=schema.sql`
4. `npx wrangler deploy`

Local test: `npx wrangler d1 execute cudmaze-db --local --file=schema.sql` then `npx wrangler dev`.

Product prices / variations / photos: edit the row in index.html (Services tab), e.g.
`<div class="list-item" data-price="15000" data-variations="Size:S|M|L;Colour:Red|Blue" data-image="img/products/x.webp">`
WhatsApp number: `WA_NUMBER` at the top of js/market.js.

## Editing content
Everything in the shop is plain HTML in `index.html` (Shop tab, `#serviceList`). Each row's `data-price`, `data-was` (old price for a sale),
`data-variations`, `data-image`, `data-kind="service"` and `data-from="1"` ("From ₦...") control the card and the product modal.
Sample sellers, prices, reviews, delivery fees and policies are PLACEHOLDERS: replace them with your real details before launch.
