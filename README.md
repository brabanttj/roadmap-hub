# Roadmap Hub

Intake ideas, review and approve them, and manage the resulting roadmap.
Built with Vite + React and a small Express + Postgres API — same stack and
component library as the sibling `ai-capability-finder` project.

## Run locally

Requires a local Postgres (via Docker Compose) and two terminals — one for
the API, one for the Vite dev server:

```bash
npm install
docker compose up -d     # local Postgres on :5432
npm run db:migrate       # create tables
npm run db:seed          # load the v1 seed data (transcribed from the
                          # original roadmap screenshot)

npm run dev:api          # terminal 1 — API on :8787
npm run dev              # terminal 2 — http://localhost:5173 (proxies /api)

npm run build            # production build -> dist/
npm run preview          # serve the production build (no API — static only)
```

## Features

- **Submit an idea** — anyone can propose an initiative (title, focus area,
  team, summary). Lands in the review queue as `idea`.
- **Review queue** — approve an idea onto the Backlog, or reject it with a
  note. Gated behind a shared password (see below).
- **Roadmap** — a Gantt-style view grouped by Focus Area → Team, with a
  Backlog column plus Jan–Dec. Click any bar to edit an initiative's fields,
  status, and schedule, or add one directly. Gated behind the same password.
- **Focus Areas & Teams** — manage the taxonomy that both pickers read from.

## Password gate

Mutating actions (review decisions, scheduling/editing initiatives, taxonomy
CRUD) are gated behind a shared password, set in
`src/lib/PasswordGate.jsx` (`GATE_PASSWORD`). This is a lightweight
UX gate, not real authentication — the API itself doesn't enforce it.
Idea submission itself stays open to anyone.

## Data

Postgres is the runtime source of truth. `scripts/seed-data.mjs` holds the
v1 baseline (transcribed directly from the roadmap screenshot that kicked
off this project — no source workbook was available to import). Re-running
`npm run db:seed` resets to that baseline; edit through the app from there.

## Project structure

```
src/
  styles/                 Design tokens + global resets (shared with lt-app)
  components/ui/          Component library: Button, Card, Badge, Input,
                          Select, Modal, Icon (+ ui.css, barrel index)
  features/
    RoadmapPlanner.jsx    Tab shell: Roadmap / Submit / Review / Taxonomy
    RoadmapGantt.jsx      The Gantt view + initiative edit modal trigger
    InitiativeModal.jsx   Create/edit form for one initiative
    IdeaForm.jsx          Public idea submission
    ReviewQueue.jsx       Approve/reject queue
    ManageTaxonomy.jsx    Focus Area / Team CRUD
  lib/
    PasswordGate.jsx      Shared mutation-guard modal
server/                   Express API + static file server
scripts/                  Seed data + loader
```

## Deployment

Two-stage Docker build (Vite build → Express serves the bundle + API) —
see `Dockerfile`. No CI pipeline or infra-as-code yet; this currently lives
on a personal GitHub repo until it moves to a proper LendingTree repo.
