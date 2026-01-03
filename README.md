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
- EPD databasepagina met filters, server-side paginatie en Excel-export

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
4. Voer de migraties uit in Supabase (SQL editor):
   ```sql
   -- supabase/migrations/001_init.sql
   -- supabase/migrations/002_add_unit_to_epd_impacts.sql
   -- supabase/migrations/003_epd_database_fields.sql
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

## EPD database
- De pagina `/epd-database` toont opgeslagen EPD's met filters, sortering en server-side paginatie.
- Filters worden via query parameters gedeeld (bijv. `?producerName=...&pcrVersion=...`).
- Export respecteert de actuele filters en sortering.

## UI redesign (InfraImpact look & feel)
- Nieuwe design tokens en UI-kit componenten in `components/ui/`.
- Layout met enterprise header/footer en ruimere content container.
- UI playground in `/ui-playground` en richtlijnen in `docs/ui-guidelines.md`.

### Hoe verder
- Breid componenten uit (modals/drawers) voor specifieke flows.
- Voer Lighthouse/a11y checks uit op de belangrijkste routes.

### Troubleshooting Supabase opslaan
- Controleer dat `SUPABASE_SERVICE_ROLE_KEY` is ingesteld in Vercel en lokaal (de server gebruikt deze key voor inserts).
- Zorg dat de migraties zijn uitgevoerd zodat kolommen overeenkomen met de payload.
- Kijk in de server logs voor een requestId en Supabase error code zonder secrets.

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
