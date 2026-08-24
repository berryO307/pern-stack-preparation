# Academic Hub

A full-stack university management system — departments, subjects, classes, faculty, students, and enrollments — built on a **workspace-isolated demo architecture** so any number of anonymous visitors can sign in and get their own private, fully-seeded sandbox without ever touching another visitor's data.

**Live demo:** https://ums-pern-stack.vercel.app
**API:** https://ums-pern-stack.up.railway.app

Full engineering write-up (architecture decisions, bugs found and fixed, root causes, verification evidence): [`classroom_project/ENGINEERING_DEEP_DIVE.md`](classroom_project/ENGINEERING_DEEP_DIVE.md)

## Stack

| Layer | Choice |
|---|---|
| Frontend framework | React 19 + [Refine](https://refine.dev/) (admin/CRUD framework) + React Router 7 |
| UI | shadcn/ui + Tailwind CSS v4 + Recharts |
| Backend | Express 5 + TypeScript |
| Database | Neon (serverless Postgres) via Drizzle ORM, WebSocket driver for real transactions |
| Auth | Better Auth (Google + GitHub OAuth) |
| Rate limiting / bot protection | Arcjet |
| Media | Cloudinary |
| Hosting | Vercel (frontend) + Railway (backend) |
| Observability | Site24x7 (RUM on the frontend, APM Insight on the backend) |

## Why this isn't a toy CRUD demo

The obvious way to build a public "try it yourself" demo is one shared database everyone reads and writes. That breaks the moment two visitors show up at once — and it's genuinely uninteresting to build. Instead:

- **Every visitor gets their own workspace**, provisioned and seeded (~950 rows: departments, subjects, classes, a shared fixture pool of teachers/students, and enrollments) the moment they sign in, and torn down on expiry.
- **Provisioning is atomic and idempotent** — a crash mid-seed can't leave a broken half-workspace, and calling "give me my workspace" any number of times from any number of tabs is always safe. This is proven with a real forced-failure test against the live database, not just reasoned about — see the deep-dive doc.
- **Real people's data never leaks into the public demo roster.** Anyone who signs in for real (not the seeded fixture pool) is automatically excluded from what other visitors can see — verified against the live database.
- **A same-origin OAuth proxy** solves the cross-site-cookie problem that breaks Safari/iOS Chrome sign-in on split-domain deploys (frontend on Vercel, backend on Railway) — a real, documented class of bug, not a hypothetical.

See the deep-dive doc for the full list, with root causes and how each was verified.

## Running locally

### Backend

```bash
cd classroom_project/classroom-backend
npm install
cp .env.example .env   # fill in DATABASE_URL, OAuth client credentials, ADMIN_EMAILS
npm run db:migrate
npm run dev             # http://localhost:8000
```

### Frontend

```bash
cd classroom_project/classroom-frontend
npm install
npm run dev              # http://localhost:5173, proxies /api to the backend
```

The frontend's Vite dev server proxies `/api/*` to `localhost:8000` (see `vite.config.ts`), and the production build does the same via a Vercel rewrite (`vercel.json`) — the browser only ever talks to its own origin, which is what keeps the auth cookie first-party. See the deep-dive doc's OAuth section for why that matters.
