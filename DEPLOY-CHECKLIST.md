# Go-live checklist — emergent.holdings

## Your steps (~15 minutes)

- [ ] Create a [Cloudflare](https://dash.cloudflare.com/sign-up) account (if needed).
- [ ] **Register** `emergent.holdings`: Domain Registration → search → purchase.
- [ ] Push this repo to GitHub (or tell the agent to save to Cursor Origin and connect that repo).
- [ ] Cloudflare → **Workers & Pages** → **Create application** → **Pages** → connect the repo.
- [ ] Confirm first deploy succeeds; note the `*.pages.dev` preview URL.
- [ ] **Custom domains** → add `emergent.holdings` → wait for SSL **Active**.
- [ ] Optional: **Email Routing** → enable forwarding for `hello@emergent.holdings`.

## Agent / follow-up in Cursor

- [ ] Swap placeholder copy in `src/pages/index.astro` when you have final positioning text.
- [ ] Add logo asset to `public/` if you have brand files.
- [ ] Commit and push after each content change (Pages redeploys on push).
