# Expense Tracker

A personal expense tracking application built with Next.js, Drizzle ORM, and Neon PostgreSQL.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start development server at localhost:3000 |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Generate SQL migration files from schema changes |
| `pnpm db:migrate` | Apply pending migrations to database |
| `pnpm db:push` | Push schema directly (dev only, skips migrations) |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |

## Database Migrations

Schema changes go through a migration workflow for safety:

1. Edit `src/db/schema.ts`
2. Run `pnpm db:generate` to create migration SQL files in `./drizzle`
3. Review the generated SQL
4. Commit the migration files with your code
5. On deploy, `pnpm db:migrate` applies pending migrations

Migration files are tracked in git and visible in PRs for review.

## Environment Variables

Create a `.env.local` file in the project root with:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
