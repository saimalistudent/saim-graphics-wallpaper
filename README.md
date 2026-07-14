# SAIM GRAPHICS & 3D WALLPAPER

Mobile-first catalog website for browsing 3D wallpaper designs. PDFs are embedded from Google Drive; orders come via WhatsApp.

## Tech Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Storage)
- Framer Motion (scroll animations)
- Recharts (admin analytics)
- Netlify (deployment)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Run the SQL in `supabase/migrations/001_schema.sql` in the SQL Editor
3. Create a Storage bucket named `thumbnails` with **public** access
4. Copy your project URL and keys

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

### 4. Upload PDFs to Google Drive

1. Upload all PDFs from `F:\Design Wallpaper` to a Google Drive folder
2. Set each file to **"Anyone with the link can view"**
3. Copy each file's ID from the share URL

### 5. Add catalogs

Use the admin panel at `/admin/login` to add catalogs, or bulk-seed via `scripts/seed-data.json`:

A pre-filled template for all 44 PDFs from `F:\Design Wallpaper` is at `scripts/seed-data.template.json`. Copy it to `seed-data.json`, replace each `PASTE_DRIVE_ID_HERE` with the Google Drive file ID, then run:

```bash
npm run seed
```

### 6. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`

## Deploy to Netlify

1. Push to GitHub
2. Connect repo in Netlify
3. Add all env vars from `.env.local` in Netlify dashboard
4. Deploy — `netlify.toml` is preconfigured

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, featured catalogs, how it works |
| `/catalogs` | All wallpaper catalogs grid |
| `/catalogs/[id]` | Google Drive PDF viewer |
| `/admin/login` | Admin login |
| `/admin/dashboard` | Analytics dashboard |
| `/admin/catalogs` | Catalog CRUD manager |

## PDF Hosting

PDFs are **never** stored in this repo or on Netlify. Only Google Drive file IDs are stored in Supabase. The site embeds PDFs via:

```
https://drive.google.com/file/d/{FILE_ID}/preview
```
