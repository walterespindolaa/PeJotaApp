# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

Run a single test file:
```bash
npx vitest run src/test/aposentadoria-calculos.test.ts
```

## Architecture

**Stack**: Vite + React 18 + TypeScript, deployed as a SPA on Vercel. All routes rewrite to `/` (see `vercel.json`).

**Backend**: Supabase (PostgreSQL + Auth). Client is at `src/integrations/supabase/client.ts`, DB types at `src/integrations/supabase/types.ts`.

**UI**: shadcn-ui (Radix UI) + Tailwind CSS with CSS variables for theming. Components at `src/components/ui/`. Dark mode via CSS class.

**State**:
- React Context for global state: `AuthContext`, `I18nContext` (language/currency), `HouseholdViewContext`, `PrivacyModeContext`
- TanStack React Query for server state (Supabase calls)
- Domain logic encapsulated in custom hooks (`src/hooks/`)

**Routing**: React Router v6 with lazy-loaded pages. Authenticated area is under `/dashboard/*` wrapped by `<ProtectedRoute>`. Premium features are wrapped by `<PageFeatureGate>` (see `src/lib/featureGateConfigs.ts`).

**Forms**: React Hook Form + Zod validation throughout.

**Internationalization**: Custom i18n system (not a library) in `src/contexts/I18nContext.tsx`. Dictionaries at `src/lib/i18n/` for pt-BR, en, es. Portuguese-first naming — most variable names, route segments, and function names are in Portuguese.

**Financial engine**: Core calculation logic in `src/lib/financial_engine/`. Life event simulators (house purchase, retirement, new child, etc.) are in `src/lib/financial_engine/decision_engine/`.

**PDF/Excel export**: jsPDF + jspdf-autotable for PDF reports, XLSX for spreadsheet exports.

**PWA**: Vite PWA plugin with Workbox. Offline caching is configured in `vite.config.ts`.

## Key Conventions

- **Naming**: Files use PascalCase for components, camelCase for utilities. Route segments and many function/variable names are in Portuguese (e.g., `useOrganiza`, `aposentadoria`, `projecoes`).
- **Path alias**: `@/*` maps to `src/*`.
- **TypeScript**: Loose config — `noImplicitAny: false`, `strictNullChecks: false`.
- **Tests**: Only financial calculation logic has unit tests (`src/test/`). Pattern: `*.test.ts`.
- **Chunks**: Vite splits vendor bundles for react, react-query, UI, charts, and PDF libs (see `vite.config.ts` `manualChunks`).
