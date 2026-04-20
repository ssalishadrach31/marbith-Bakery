# Marbith Bakery and Investments — Management System

A full-stack bakery management system for Marbith Bakery and Investments in Kampala, Uganda.

## Architecture

**Monorepo** managed by pnpm workspaces:
- `artifacts/api-server` — Express + TypeScript REST API (port 8080)
- `artifacts/bakery` — React + Vite frontend (port 23375 / external 3000)
- `lib/db` — Drizzle ORM + PostgreSQL schema + seed script
- `lib/api-spec` — OpenAPI specification (`openapi.yaml`)
- `lib/api-client-react` — Auto-generated React Query hooks (orval)
- `lib/api-zod` — Auto-generated Zod schemas (orval)

## User Roles

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Admin | admin | admin123 | Full system access |
| Staff/Cashier | cashier1 | staff123 | POS + Production |
| Rider | rider1 | rider123 | My Deliveries only |

## Features / Modules

1. **Dashboard** — Today's revenue, stock alerts, recent activity (Admin)
2. **Production** — Record daily batches, today's summary, history (Admin/Staff)
3. **Inventory** — Stock levels, low-stock alerts, manual adjustments (Admin)
4. **POS Sales** — Cart-based sales terminal with receipt printing (Admin/Staff)
5. **Online Orders** — Manage incoming orders, assign riders (Admin)
6. **Deliveries** — Track delivery status, fee collection (Admin)
7. **Wholesale** — Business customers, supply records, outstanding balances (Admin)
8. **Employees** — Team management, roles, salaries (Admin)
9. **Attendance** — Daily check-in/check-out tracking (Admin)
10. **Payments** — MTN MoMo & Airtel Money transaction recording (Admin)
11. **Products** — CRUD for product catalog (Admin)
12. **Public Order Form** — `/order` — no login required (customers)
13. **Rider Portal** — My Deliveries view for riders

## Tech Stack

- **Frontend**: React 19, Vite 7, TailwindCSS v4, shadcn/ui components, React Query v5, Wouter router
- **Backend**: Express.js, JWT auth (jsonwebtoken), pino logging
- **Database**: PostgreSQL with Drizzle ORM
- **API**: OpenAPI 3.0 spec → orval codegen → React Query hooks + Zod schemas
- **Currency**: UGX (Ugandan Shillings)
- **Payments**: MTN Mobile Money, Airtel Money, Cash

## Key Files

- `artifacts/api-server/src/routes/` — 11 route files (auth, products, production, inventory, sales, orders, deliveries, wholesale, employees, payments, dashboard)
- `lib/db/src/schema/` — 11 Drizzle schema files
- `artifacts/bakery/src/pages/` — 13 page components
- `artifacts/bakery/src/components/layout.tsx` — Sidebar navigation
- `lib/db/src/seed.ts` — Demo data seeding (run with `pnpm --filter @workspace/db exec tsx src/seed.ts`)

## Products Seeded

Pizza (5000), Rock Bun (1500), Cakes 6pcs (2500), Madeira Cake (1000), Vanilla Muffins (2000), Egg Rolls (2000), Sumbusa (1000), Chapattis (1000), Mandazi 6pcs (2500), Plain Donuts (1000), Cookies (1000), Cinnamon Roll (1000), Teabites (3000), American Donuts (2000)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — JWT signing secret (set as Replit secret)
- `PORT` — Server port (auto-assigned per artifact)
- `BASE_PATH` — Vite base URL prefix (auto-assigned per artifact)
