# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an expense tracker application built with Next.js 16 (App Router), React 19, Drizzle ORM, and Neon PostgreSQL.

## Package Manager

This project uses **pnpm**. Always use pnpm for installing dependencies and running scripts.

## Documentation Rules

Maintain a simple, small README.md in the **project root** (`/Users/alpsilva/projects/expense-tracker/README.md`) with:
- All important commands and their descriptions
- Required environment variables and their purpose

**Important:** The README to update is at the repository root, NOT inside the `expense-tracker/` subdirectory.

Update the README when adding new commands or environment variables.

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Database migrations
pnpm db:generate    # Generate SQL migration from schema changes
pnpm db:migrate     # Apply pending migrations
pnpm db:studio      # Open Drizzle Studio GUI
pnpm db:push        # Push schema directly (dev only, skips migrations)
```

## Architecture

### Tech Stack
- **Framework:** Next.js 16 with App Router (src/app directory)
- **Database:** Neon serverless PostgreSQL with Drizzle ORM
- **Styling:** Tailwind CSS v4
- **Validation:** Zod for schema validation
- **Performance:** React Compiler enabled for automatic memoization

### Path Aliases
- `@/*` maps to `./src/*` (configured in tsconfig.json)

### Database
- Connection configured via `DATABASE_URL` in `.env.local`
- Schema defined in `src/db/schema.ts`
- **Migration workflow:**
  1. Edit schema.ts
  2. Run `pnpm db:generate` to create SQL migration
  3. Review generated SQL in `./drizzle/`
  4. Commit migration files
  5. Run `pnpm db:migrate` to apply

### Project Structure
```
src/app/              # Next.js App Router pages and layouts
src/app/api/          # API routes
src/components/       # React components
src/components/ui/    # Reusable UI components (shadcn/ui)
src/components/ledger/# Loan ledger components
src/db/               # Database schema and connection
src/lib/              # Utilities, formatters, queries
drizzle/              # Generated SQL migrations
public/               # Static assets
```

## Features

### Recurring Expenses
Track monthly and yearly recurring expenses with categories, payment methods, and due dates.

### Loan Ledger
People-first loan tracking system:
- **Ledger model:** Each person has a ledger (list of transactions)
- **Transaction types:** `lent` (money out) and `received` (money in)
- **Balance calculation:** Sum of transactions determines who owes whom
- **Disregard feature:** Transactions can be marked as disregarded (excluded from balance but kept for audit)

**Routes:**
- `/loans` - List of people with balances and quick-add buttons
- `/loans/[id]` - Person's transaction history
- `/loans/new` - Create new person

**API endpoints:**
- `GET/POST /api/people` - List/create people
- `GET/PUT/DELETE /api/people/[id]` - Person details
- `POST /api/people/[id]/transactions` - Create transaction
- `PATCH /api/people/[id]/transactions/[txId]` - Update transaction (toggle disregard)

## API Patterns

### Authentication
All API routes use `getAuthUserId()` from `@/lib/api-auth` and return `unauthorizedResponse()` if not authenticated.

### Input Validation
Validate request body fields before database operations:
- Check enum values against allowed list
- Parse numbers and verify `Number.isFinite()` and range
- Parse dates and verify `!isNaN(date.getTime())`
- Return 400 with descriptive error message on validation failure

### Response Patterns
- `200` - Success (GET, PUT, PATCH)
- `201` - Created (POST)
- `400` - Bad request (validation errors)
- `401` - Unauthorized
- `404` - Not found
