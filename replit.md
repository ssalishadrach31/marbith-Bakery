# Marbith Bakery and Investments — Management System

A full-stack bakery management system for Marbith Bakery and Investments in Kampala, Uganda.

## Production Deployment

- **Frontend**: https://marbith-bakery.vercel.app (Vercel)
- **Backend API**: https://marbith-bakery.onrender.com (Render)
- **Database**: Neon PostgreSQL (NEON_DATABASE_URL secret)

All data is stored in Neon. The Replit environment is for development only.

## Architecture

**Monorepo** managed by pnpm workspaces:
- `artifacts/api-server` — Express + TypeScript REST API
- `artifacts/bakery` — React + Vite frontend
- `lib/db` — Drizzle ORM + PostgreSQL schema
- `lib/api-spec` — OpenAPI specification (`openapi.yaml`)
- `lib/api-client-react` — Auto-generated React Query hooks (orval)
- `lib/api-zod` — Auto-generated Zod schemas (orval)

## User Roles

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Admin | shadrachssali@gmail.com | admin123 | Full system access |
| Admin | martha@marbithbakery.com | password123 | Full system access |
| Staff | vivian@marbithbakery.com | vivian123@ | Shift Dashboard + POS + Production + Expenses |
| Cashier | sharon@marbithbakery.com | @sharon123 | Shift Dashboard + POS + Expenses |
| Baker | samuel@marbithbakery.com | 123@samuel | Kitchen Dashboard + Production + Expenses |
| Baker | kato@marbithbakery.com | kato123@ | Kitchen Dashboard + Production + Expenses |
| Baker | asuman@marbithbakery.com | asuman123 | Kitchen Dashboard + Production + Expenses |
| Baker | rubangakene@marbithbakery.com | samuel123 | Kitchen Dashboard + Production + Expenses |
| Rider | rider1 | rider123 | My Deliveries only |

## Employees

- Shadrach Ssali (Admin)
- Martha Nakato (Admin)
- Vivian Apio (Staff)
- Sharon Nambi (Cashier)
- Samuel Kizza (Baker)
- Kato Ssemakula (Baker)
- Asuman Kato (Baker)
- Rubangakene Samuel (Baker)
- Rider One (Rider)

## Features / Modules

1. **Dashboard** — Today's revenue, stock alerts, recent activity (Admin)
2. **Production** — Record daily batches, today's summary, history (Admin/Staff/Baker)
3. **Inventory** — Stock levels, low-stock alerts, manual adjustments (Admin)
4. **POS Sales** — Cart-based sales terminal with receipt printing (Admin/Staff/Cashier)
5. **Online Orders** — Manage incoming orders, assign riders (Admin)
6. **Deliveries** — Track delivery status, fee collection (Admin)
7. **Wholesale** — Business customers, supply records, outstanding balances (Admin)
8. **Employees** — Team management, roles, salaries (Admin)
9. **Attendance** — Daily check-in/check-out tracking (Admin)
10. **Payments** — MTN MoMo & Airtel Money transaction recording (Admin)
11. **Products** — CRUD for product catalog (Admin)
12. **Public Order Form** — `/order` — no login required (customers)
13. **Rider Portal** — My Deliveries view for riders
14. **Shift Dashboard** — Full daily operations dashboard (Staff/Cashier)
15. **Baker Dashboard** — Production tracking for bakers

## Product Catalog (40 products)

**Baked Goods (13):** Pizza, Rock Bun, Cakes 6pcs, Madeira Cake, Vanilla Muffins, Egg Rolls, Chapattis, Mandazi 6pcs, Plain Donuts, Cookies, Cinnamon Roll, Teabites, American Donuts

**Snacks (1):** Sumbusa

**Drinks/Sodas (13):** Bongo, Coffee Malt, Energy, Minute Maid, Minute Maid Big, Nkoge, Onner, Predator, Rockboom, Soda 330ml, Soda 500ml, Sting, Tamarind

**Milk & Dairy (5):** Fresh Dairy Tin, Jesa Milk, Jesa Milk Flavored, Jesa Sachet, Probiotic Tin

**Ice Cream (4):** Ice Cream Big Cone, Ice Cream Big Tin, Ice Cream Small Cone, Ice Cream Small Tin

**Juice (2):** Juice Big Tin, Juice Small Tin

**Coffee (1):** Milk Coffee

**Tea (1):** Black Tea

## Tech Stack

- **Frontend**: React 19, Vite 7, TailwindCSS v4, shadcn/ui components, React Query v5, Wouter router
- **Backend**: Express.js, JWT auth (jsonwebtoken), pino logging
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **API**: OpenAPI 3.0 spec → orval codegen → React Query hooks + Zod schemas
- **Currency**: UGX (Ugandan Shillings)
- **Payments**: MTN Mobile Money, Airtel Money, Cash

## Key Files

- `artifacts/api-server/src/routes/` — Route files (auth, products, production, inventory, sales, orders, deliveries, wholesale, employees, payments, dashboard, staff-dashboard)
- `lib/db/src/schema/` — Drizzle schema files
- `artifacts/bakery/src/pages/` — Page components
- `artifacts/bakery/src/components/layout.tsx` — Sidebar navigation
- `lib/db/src/seed-full.ts` — Full product + staff seeding (run against NEON_DATABASE_URL)

## Environment Variables

- `NEON_DATABASE_URL` — Neon PostgreSQL connection string (Replit secret + Render env var)
- `DATABASE_URL` — Replit internal DB (dev only, not used in production)
- `SESSION_SECRET` — JWT signing secret
- `PORT` — Server port (auto-assigned per artifact)
- `CORS_ORIGIN` — Allowed frontend origins (set on Render: https://marbith-bakery.vercel.app)
