# Cloudflare Workers Deployment

Repo ini disiapkan agar aplikasi Next.js di `web/` bisa di-deploy ke Cloudflare Workers memakai adapter OpenNext, tanpa mengubah workflow bawaan Next.js, Firebase, APK/Capacitor, maupun script di `web/package.json`.

## Konfigurasi yang ditambahkan

- `wrangler.jsonc` di root repo dipakai oleh Cloudflare Workers Builds saat menjalankan default command `npx wrangler deploy` dari root repo.
- `web/wrangler.jsonc` dipakai jika deploy dijalankan dari folder `web`.
- `web/open-next.config.ts` memakai konfigurasi default adapter `@opennextjs/cloudflare`.
- `web/public/_headers` memberi cache immutable untuk aset `/_next/static/*`.
- `web/.dev.vars.example` adalah template environment lokal untuk preview Workers.

## Deploy dari Cloudflare Workers Builds

Gunakan konfigurasi berikut di Cloudflare:

- Root directory: root repo ini.
- Deploy command: biarkan default `npx wrangler deploy`.

Root `wrangler.jsonc` akan menjalankan build command berikut sebelum deploy:

```bash
npm --prefix web ci && npm --prefix web install --no-save --package-lock=false @opennextjs/cloudflare@latest && cd web && npx -y @opennextjs/cloudflare@latest build
```

Urutannya:

1. Install dependency aplikasi `web` dari lockfile.
2. Install adapter OpenNext secara ephemeral tanpa mengubah `package.json` atau `package-lock.json`.
3. Build output Worker ke `web/.open-next`.
4. Wrangler deploy `web/.open-next/worker.js` dan `web/.open-next/assets`.

Pastikan environment variable Firebase/Next.js yang diperlukan aplikasi sudah dibuat di Cloudflare Workers sebagai variables/secrets, terutama variable `NEXT_PUBLIC_*` yang dibaca saat build.

## Deploy lokal dari root repo

```bash
npx wrangler deploy
```

## Deploy lokal dari folder `web`

```bash
cd web
npm ci
npm install --no-save --package-lock=false @opennextjs/cloudflare@latest
npx @opennextjs/cloudflare build
npx wrangler deploy
```

## Preview lokal Workers

```bash
cd web
cp .dev.vars.example .dev.vars
npm ci
npm install --no-save --package-lock=false @opennextjs/cloudflare@latest
npx @opennextjs/cloudflare preview
```

## Pin dependency untuk CI

Jika ingin build yang lebih reproducible, pin dependency ini di `web/devDependencies` dan commit lockfile:

```bash
cd web
npm install --save-dev @opennextjs/cloudflare@latest wrangler@latest
```

Setelah dependency dipin, build command Wrangler bisa disederhanakan agar tidak perlu `npm install --no-save` lagi.
