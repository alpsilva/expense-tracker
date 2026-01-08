# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an expense tracker application built with Next.js 16 (App Router), React 19, Drizzle ORM, and Neon PostgreSQL.

## Package Manager

This project uses **pnpm**. Always use pnpm for installing dependencies and running scripts.

## Documentation Rules

Maintain a simple, small README.md in the project root with:
- All important commands and their descriptions
- Required environment variables and their purpose

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
- Use Drizzle Kit for migrations: `npx drizzle-kit` commands
- Drizzle schema files should define tables with type-safe TypeScript

### Project Structure
```
src/app/          # Next.js App Router pages and layouts
public/           # Static assets
```
