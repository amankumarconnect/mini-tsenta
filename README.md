# Mini-Tsenta Monorepo

This monorepo contains the source code for the Mini-Tsenta application, featuring an AdonisJS API and an Electron Desktop application.

## Prerequisites

- Node.js (v20 or later)
- pnpm
- PostgreSQL (running and accessible)

## Project Structure

- `apps/api`: Backend API built with AdonisJS
- `apps/desktop`: Desktop application built with Electron

## Setup

1.  **Install Dependencies**

    ```bash
    pnpm install
    ```

2.  **Configure API Environment**

    Copy the example environment file in the API directory:

    ```bash
    cp apps/api/.env.example apps/api/.env
    ```

    Update `apps/api/.env` with your database credentials and other settings.
    Ensure `DATABASE_URL` is correctly set for Prisma.

3.  **Configure Desktop Environment**

    Copy the example environment file in the Desktop directory:

    ```bash
    cp apps/desktop/.env.example apps/desktop/.env
    ```

    Update `apps/desktop/.env`. The desktop app also uses `DATABASE_URL` and `OLLAMA` keys.

4.  **Database Setup**

    Navigate to the API directory and run migrations:

    ```bash
    cd apps/api
    npx prisma migrate dev
    # OR
    npx prisma db push
    ```

    _Note: You may need to generate the Prisma Client if you encounter issues:_

    ```bash
    npx prisma generate
    ```

## Running the Application

This project uses `pnpm` workspaces. You can run commands from the root directory.

### Start the API Server

```bash
pnpm run dev:api
```

Runs the AdonisJS API server.
Access at: `http://localhost:3333`

### Start the Desktop App

```bash
pnpm run dev:desktop
```

Starts the Electron desktop application.

### Start Both concurrently

```bash
pnpm run dev
```

Runs both the API server and the Desktop application simultaneously using `concurrently`. This is the recommended way to start the development environment.

## Development

- **Linting:** `pnpm run lint`
- **Type Checking:** `pnpm run typecheck`
- **Formatting:** `pnpm run format`
