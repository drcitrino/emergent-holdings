# Emergent Holdings — website

Static marketing site for [emergent.holdings](https://emergent.holdings), built with [Astro](https://astro.build) and designed for [Cloudflare Pages](https://pages.cloudflare.com/).

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Production build

```bash
npm run build
npm run preview
```

Output is written to `dist/`.

## Deploy on Cloudflare Pages

1. **Register the domain** (if you have not already): Cloudflare Dashboard → **Domain Registration** → search `emergent.holdings` → checkout (~$50/yr at-cost).
2. **Create a Pages project**: Workers & Pages → **Create** → **Pages** → **Connect to Git** (GitHub) or **Direct Upload**.
3. **Build settings** (Git-connected repo):

   | Setting | Value |
   |---------|--------|
   | Framework preset | Astro |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node.js version | 22 (or latest LTS in Pages settings) |

4. **Custom domain**: Pages project → **Custom domains** → add `emergent.holdings` and `www.emergent.holdings` (redirect www → apex in Cloudflare if desired).
5. If the domain is on Cloudflare, DNS records for Pages are applied automatically once the domain is linked.

## Content updates

- Copy and sections: `src/pages/index.astro`
- Global layout, meta tags, header/footer: `src/layouts/BaseLayout.astro`
- Visual design: `src/styles/global.css`

## Contact email

The site uses `hello@emergent.holdings`. After the domain is live, configure email forwarding or a mailbox at your registrar or Cloudflare Email Routing.
