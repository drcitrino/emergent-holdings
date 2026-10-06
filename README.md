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

## Deploy to Cloudflare (Workers static assets)

After `npm run build`:

```bash
npx wrangler deploy
```

`wrangler.toml` attaches **emergent.holdings** and **www.emergent.holdings** as custom domains. Requires `npx wrangler login` once on your machine.

**Repo:** https://github.com/drcitrino/emergent-holdings

## Content updates

- Copy and sections: `src/pages/index.astro`
- Global layout, meta tags, header/footer: `src/layouts/BaseLayout.astro`
- Visual design: `src/styles/global.css`

## Contact email

The site uses `hello@emergent.holdings`. After the domain is live, configure email forwarding or a mailbox at your registrar or Cloudflare Email Routing.
