# EPD database

Next.js 14 applicatie voor het beheren van Environmental Product Declarations (EPD's) voor infrastructuurproducten. De app ondersteunt het uploaden van PDF's, het automatisch parsen van EPD-gegevens, handmatige validatie, opslag in Supabase en export naar Excel of CSV.

## Features
- Upload EPD-PDF's naar Supabase Storage
- Server-side tekstextractie met `pdf-parse`
- Automatische parsing van kernvelden en MKI/CO2-waarden
- Handmatige review en aanvullende custom velden
- Opslag in Supabase Postgres (epd_files, epds, epd_impacts)
- Overzichtspagina met zoeken en paginatie
- Detailpagina met alle impactwaarden en downloadlink naar PDF
- Export naar Excel of CSV
- Klaar voor deployment op Vercel (geen GitHub Pages)

## Projectstructuur
- `app/` – App Router pagina's en API routes
- `lib/` – Helpers zoals Supabase client, parser en export helpers
- `supabase/migrations/` – SQL voor het aanmaken van tabellen
- `app/globals.css` – Tailwind en basisstyling
- `next.config.mjs` – configuratie met optionele `basePath`

## Installatie en ontwikkeling
1. Installeer dependencies:
   ```bash
   npm install
   ```
2. Kopieer `.env.local.example` naar `.env.local` en vul de waarden in:
   ```bash
   cp .env.local.example .env.local
   ```
3. Zorg dat de volgende variabelen zijn gezet (in `.env.local` en Vercel):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` (en `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`) – standaard `epd-pdfs`
   - `NEXT_PUBLIC_BASE_PATH` (optioneel, voor deployment onder subpad)
4. Voer de migratie uit in Supabase (SQL editor):
   ```sql
   -- supabase/migrations/001_init.sql
   ```
5. Start de ontwikkelserver:
   ```bash
   npm run dev
   ```

> Let op: `.env.local` staat in `.gitignore` en mag niet worden gecommit.

## Deployment
- Deploy op Vercel of een andere host die Next.js serverfuncties ondersteunt. GitHub Pages werkt niet vanwege de vereiste server-side API routes en `pdf-parse`.
- Stel dezelfde environment variabelen in als lokaal.
- Gebruik `NEXT_PUBLIC_BASE_PATH` indien de app onder een subpad draait (bijvoorbeeld `/epd_database`).

## Export
- Gebruik de knop "Exporteer naar Excel" op de overzichtspagina, of roep `/api/epd/export?format=excel|csv` rechtstreeks aan.

## How to add a new EPD format parser
1. Voeg een nieuwe parser toe in `lib/epd/parsers/` (bijv. `myFormat.ts`).
2. Exporteer een parser object met:
   - `id`: unieke id string.
   - `canParse({ text, meta })`: retourneer een score tussen `0` en `1` en een korte `reason`.
   - `parse({ text, meta })`: retourneer een `EpdNormalized` object.
3. Registreer de parser in `lib/epd/registry.ts` door hem toe te voegen aan de `parsers` array.
4. Zorg dat je parser minimaal vult:
   - `productName`, `declaredUnit`, `manufacturer`, `issueDate`, `validUntil`.
   - `lcaStandard` via `normalizeLcaStandard()` (`lib/epd/normalize.ts`).
   - `results` + `modulesDeclared` (gebruik eventueel `parseImpactTableDynamic`).
5. Voeg tests toe in `tests/` met fixtures zodat parser-selectie en output stabiel blijven.

Voorbeeld (schets):
```ts
export const myParser = {
  id: 'myFormatV1',
  canParse: ({ text }) => ({ score: text.includes('MyFormat') ? 0.9 : 0, reason: '...' }),
  parse: ({ text }) => ({ normalized: { ... } }),
};
```
