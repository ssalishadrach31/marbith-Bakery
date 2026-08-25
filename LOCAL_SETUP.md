# Running Marbith Bakery Management System Locally

## What you need installed on your laptop

1. **Node.js** (v20 or later) — https://nodejs.org
2. **pnpm** — run this after installing Node: `npm install -g pnpm`
3. **PostgreSQL** — https://www.postgresql.org/download/

---

## Step 1 — Get the code

Clone the project from GitHub:

```bash
git clone https://github.com/ssalishadrach31/marbith-Bakery.git
cd marbith-Bakery
```


---

## Step 2 — Create a local PostgreSQL database

Open your terminal / Command Prompt and run:

```bash
psql -U postgres
```

Then inside psql:

```sql
CREATE DATABASE marbith_bakery;
\q
```

---

## Step 3 — Create the environment file

In the project root folder, create a file called `.env` with this content:

```
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/marbith_bakery
SESSION_SECRET=any-long-random-string-you-choose
```

Replace `YOUR_POSTGRES_PASSWORD` with the password you set when installing PostgreSQL.

---

## Step 4 — Install dependencies

Open a terminal in the project root folder and run:

```bash
pnpm install
```

---

## Step 5 — Set up the database tables and data

```bash
pnpm --filter @workspace/db exec tsx src/migrate.ts
pnpm --filter @workspace/db exec tsx src/seed.ts
```

This creates all the tables and loads your products, employees, and the admin account.

---

## Step 6 — Start the app

Open **two terminals** in the project folder:

**Terminal 1 — Backend API:**
```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend:**
```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/bakery run dev
```

Then open your browser and go to: **http://localhost:3000**

---

## Your Admin Login

| Field    | Value                        |
|----------|------------------------------|
| Username | shadrachssali@gmail.com      |
| Password | admin123                     |

**Change your password** after first login via Settings → User Management.

---

## Keeping your data

All data is stored in your local PostgreSQL database on your laptop. It will not be lost when you close the app — it persists as long as PostgreSQL is running.

To back up your data:
```bash
pg_dump -U postgres marbith_bakery > backup.sql
```

To restore from backup:
```bash
psql -U postgres marbith_bakery < backup.sql
```

---

## Also deploying online?

Use Vercel for the bakery frontend and Render for the API. Set `VITE_API_URL` in Vercel to the Render API URL, and set `NEON_DATABASE_URL` in Render to the Neon production connection string.
