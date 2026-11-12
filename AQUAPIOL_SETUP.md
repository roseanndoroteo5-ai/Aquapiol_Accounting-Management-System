# AquaPiol Accounting Management System

This integration keeps the existing XianFire / Express / Handlebars (`.xian`) project and adds role-based authentication, an accounting dashboard, chart of accounts, transaction entry, financial summaries, and admin-only user management.

## Requirements
- Node.js 18+
- MySQL / Laragon MySQL service
- Existing npm dependencies from `package.json`

## Setup
1. Start MySQL in Laragon or your MySQL service.
2. Check `models/db.js` or set the database environment variables shown in `.env.example` in your terminal. The current project does not auto-load `.env` files. The default database is `accounting_management`, user `root`, blank password.
3. In the project directory, run `npm install` if dependencies are not installed.
4. Run `npm run migrate`. This uses Sequelize `sync()` without `force:true`; it does not intentionally drop existing tables or data.
5. Run `npm run seed:users` once to create starter accounts if the Users table is empty.
6. Run `npm run xian` and open `http://localhost:3000`.

## Initial login (only when the Users table is empty)
- Admin: `admin@aquapiol.local` / `Admin@12345`
- Staff: `staff@aquapiol.local` / `Staff@12345`

Change the starter passwords before using this system with real business data. You can override them before seeding with `SEED_ADMIN_PASSWORD` and `SEED_STAFF_PASSWORD` environment variables.

## Roles
- Admin: dashboard, accounting pages, reports, and user management.
- Staff: dashboard, chart of accounts, transactions, and reports. Staff cannot access user management.

## Notes
- The original project files, XianFire CLI, and existing package dependencies are retained.
- New accounting tables are created only when missing. The earlier `Users` table gets an additive `isActive` column if it does not already have one.
- This is a functional starter integration. Before production use, configure a persistent session store, HTTPS, a strong session secret, CSRF protection, backups, and complete debit/credit posting workflows. The current dashboard net figure is total recorded receipts less recorded expenses, not a formal accrual-basis net income statement.


## Module-to-module REST API

The Accounting module now exposes a versioned REST API at `/api/v1/accounting`. See [`docs/AQUAPIOL_ACCOUNTING_API.md`](docs/AQUAPIOL_ACCOUNTING_API.md) for endpoint details, Bearer Token configuration, sample requests/responses, logical permissions, deployment guidance, and database ownership. Configure `API_BEARER_TOKEN` and `API_SERVICE_USER_ID` on the server before enabling API writes.
