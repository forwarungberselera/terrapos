# TerraPOS Web

Aplikasi web TerraPOS dibangun dengan Next.js. Konfigurasi bawaan tetap mendukung alur yang sudah ada:

- `npm run dev` untuk development lokal Next.js.
- `npm run build` dan `npm run start` untuk mode server Next.js.
- `npm run build:apk` untuk export statis yang dipakai build APK/Capacitor.
- `npm run deploy:pages` untuk deploy output statis `out/` ke Cloudflare Pages yang sudah ada.

## Cloudflare Workers (opsional)

Repo ini juga disiapkan agar bisa dijalankan di Cloudflare Workers melalui adapter OpenNext, tanpa mengganti konfigurasi Next.js/Firebase/APK yang sudah ada.

### File konfigurasi

- `../wrangler.jsonc` dipakai saat Cloudflare menjalankan deploy dari root repo dengan default deploy command `npx wrangler deploy`. File ini otomatis menjalankan `npm --prefix web ci && npm --prefix web run build:workers`, lalu deploy output OpenNext dari `web/.open-next`.
- `wrangler.jsonc` di folder `web` dipakai saat menjalankan command dari folder `web` secara lokal/CI. File ini menunjuk entry Worker hasil build OpenNext di `.open-next/worker.js`, static assets di `.open-next/assets`, mengaktifkan `nodejs_compat`, dan memakai nama Worker `terrapos-web`.
- `open-next.config.ts` memakai konfigurasi default `@opennextjs/cloudflare`.
- `public/_headers` menambahkan cache immutable untuk aset Next.js.
- `.dev.vars.example` dapat disalin menjadi `.dev.vars` untuk preview lokal Workers.

### Persiapan lokal

```bash
cd web
npm install
cp .dev.vars.example .dev.vars
```

> Catatan: script Cloudflare Workers menjalankan `npm run ensure:workers-deps` untuk memasang `@opennextjs/cloudflare` secara lokal dengan `--no-save --package-lock=false` sebelum build. Ini diperlukan karena `open-next.config.ts` mengimpor adapter tersebut, tetapi dependency utama aplikasi dan lockfile existing tetap tidak diubah. Jika ingin pin versi untuk CI, install paket berikut lalu hapus prefix `npm run ensure:workers-deps &&` dari script Workers:
>
> ```bash
> npm install --save-dev @opennextjs/cloudflare@latest wrangler@latest
> ```

### Preview di runtime Workers

```bash
npm run preview:workers
```

Perintah ini membangun Next.js, mengubah output menjadi Worker via OpenNext, lalu menjalankannya dengan Wrangler di runtime `workerd` lokal.

### Deploy ke Cloudflare Workers

Login Wrangler terlebih dahulu jika belum:

```bash
npx -y wrangler@latest login
```

Deploy dari root repo, sama seperti default deploy command Cloudflare Workers Builds:

```bash
npx wrangler deploy
```

Alternatif deploy dari folder `web`:

```bash
cd web
npm run deploy:workers
```

Untuk CI/CD Cloudflare Workers Builds, gunakan root directory repo dan biarkan deploy command default:

```bash
npx wrangler deploy
```

Konfigurasi root `wrangler.jsonc` akan meng-install dependency `web` dengan `npm ci`, memasang adapter OpenNext secara ephemeral lewat `ensure:workers-deps`, menjalankan build OpenNext, lalu men-deploy Worker. Pastikan semua environment variable Firebase/Next.js yang diperlukan aplikasi sudah dibuat di Cloudflare Workers sebagai variables/secrets, khususnya variable `NEXT_PUBLIC_*` yang dibaca saat build.

### Type generation untuk binding Cloudflare

```bash
npm run cf-typegen
```

File `cloudflare-env.d.ts` sengaja diabaikan git karena bisa dibuat ulang dari konfigurasi Wrangler.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
