# Clear Routes

Reality-check a UK career route before you commit time or money. Clear Routes turns a role + your situation into a route judgement: best route in, backup route, route to avoid, what's realistic locally, and a first move for this week.

Live at: https://clearroutes.co.uk

## What it does

- **Reality-check** — an AI-assisted route judgement for a specific role, given your situation.
- **My Career Decisions** — saved route checks you can revisit and compare.
- **Decision Profile** — your saved constraints (hours, budget, qualifications, location, support context) reused on every check.
- **Support matching** — surfaces UK funded programmes that may be relevant to your Decision Profile.
- **Role pages** — curated, hand-written role information: realistic pathways in, salary ranges, competition, AI exposure, training providers.

The product is free. There is no paid tier and no checkout.

## Tech stack

- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/ui
- Backend: Lovable Cloud (Postgres + Auth + Edge Functions)
- AI: used for the Reality-check route judgement
- Analytics: PostHog
- Hosting: Lovable (frontend), Lovable Cloud (backend, EU region)

## Project structure

- `/src/pages` — top-level routes (`Index`, `RolePage`, `MyDecisions`, `Personalise`, `Support`, etc.)
- `/src/components` — shared UI components
- `/src/components/role` — role-page components (Reality-check, support matches, pathways, salary grid)
- `/src/lib/reality-check` — Reality-check profile mapping and route recommendation logic
- `/src/lib/saved-decisions.ts` — saved career decision helpers
- `/src/hooks` — custom React hooks
- `/src/integrations/supabase` — backend client and generated types
- `/supabase/functions` — edge functions (`reality-check`, `search-roles`, `get-role`, `fetch-job-count`)
- `/supabase/migrations` — database schema migrations

## Edge functions

- `reality-check` — takes a role + Decision Profile answers, returns the AI-assisted route judgement
- `search-roles` — role search for the homepage
- `get-role` — role page payload
- `fetch-job-count` — live UK job count for a role (Reed API)

## Environment variables

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` — backend client config (frontend, auto-managed)
- `LOVABLE_API_KEY` — AI Gateway key used by the Reality-check edge function (backend secret)
- `POSTHOG_KEY` — currently hardcoded in `src/lib/posthog.ts`; should be moved to env

## Local development

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173. Edge functions run on Lovable Cloud and auto-deploy from the repo.

## Testing

```bash
npm run test
```

Vitest unit tests cover Reality-check profile mapping, route recommendation, saved decisions, and role helpers.

## Deployment

Frontend deploys via Lovable on push. Edge functions deploy via Lovable Cloud. Domain (clearroutes.co.uk) is managed via Namecheap.

## Known issues / tech debt

- Several pages use `as any` to bypass generated type checks; types should be regenerated.
- `RolePage.tsx` is oversized and should be decomposed further.
- PostHog API key is hardcoded in `src/lib/posthog.ts` and should be moved to env.
- Integration test coverage of the full Reality-check → save decision flow is still light.
