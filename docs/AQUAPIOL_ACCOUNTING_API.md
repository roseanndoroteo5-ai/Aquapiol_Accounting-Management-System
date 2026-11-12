# AquaPiol Accounting REST API (v1)

This service exposes a versioned API for authorized AquaPiol modules such as POS. It uses the existing Accounting database models; it does not expose direct database access or let consumers update Accounting-owned tables directly.

## Base URL

- Local: `http://localhost:3000/api/v1/accounting`
- Shared test server: `http://<accounting-server-host>:3000/api/v1/accounting`
- Production: use your deployed HTTPS host, for example `https://<your-domain>/api/v1/accounting`

`localhost` refers to the computer making the request. If POS and Accounting run on different computers, POS must use the Accounting computer's reachable LAN IP/hostname or deployed domain. Configure firewall/network access and HTTPS for non-local environments.

## Configure authentication

Set these server environment variables (do not commit real values):

- `API_BEARER_TOKEN`: a long, random secret shared only with authorized module services.
- `API_SERVICE_USER_ID`: ID of an active user in the Accounting `Users` table. API-created journal entries and payments are attributed to this service user because the existing schema requires `createdBy`.

Generate a token with `openssl rand -hex 32` or an equivalent secure random generator. Store it in the Accounting server's environment and in the secret store/environment of each authorized consuming service. Never put it in browser-side JavaScript or a public repository. The current implementation uses one shared token; rotate it if exposed. Use separate credentials/scopes or an API gateway before broad production deployment.

Every endpoint except `GET /health` requires:

```http
Authorization: Bearer <API_BEARER_TOKEN>
Content-Type: application/json
```

## Endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/health` | Public, read-only | Service and database health check |
| GET | `/accounts` | `account:read` (shared token) | List active chart-of-account entries |
| GET | `/transactions` | `transaction:read` (shared token) | List posted journal entries |
| POST | `/transactions/posting` | `transaction:post` (shared token) | Post a balanced journal entry |
| POST | `/payments` | `payment:create` (shared token) | Record an incoming/outgoing payment |

The permission names are the agreed logical permissions for integration documentation. The starter implementation currently enforces possession of the configured shared Bearer token, not separate per-scope claims. Do not treat the names as independently enforced scopes.

### 1. Health check

`GET /health`

Example response:

```json
{"success":true,"data":{"service":"aquapiol-accounting-api","version":"v1","status":"ok"}}
```

### 2. Read active accounts

`GET /accounts` optionally accepts `?type=asset` (valid types: `asset`, `liability`, `equity`, `revenue`, `expense`). Returns account IDs, codes, names and types. POS should use the returned `id` when submitting a journal posting; do not assume IDs across environments are identical.

```json
{"success":true,"data":[{"id":1,"accountCode":"1000","accountName":"Cash on Hand","accountType":"asset","description":"Cash account","isActive":true}],"meta":{"count":1}}
```

### 3. Read posted transactions

`GET /transactions?from=2026-01-01&to=2026-01-31&limit=50`

Dates use `YYYY-MM-DD`; limit is 1–100 (default 50). Only posted journal entries are returned.

### 4. Post a journal entry

`POST /transactions/posting`

A posting must contain 2–100 lines, use active Accounting account IDs, and have equal debit and credit totals. Each line must have either a positive debit or a positive credit, not both. `referenceNumber` is unique and is used to detect duplicate retries; a repeated reference returns HTTP 409.

```json
{
  "referenceNumber": "POS-SALE-2026-000123",
  "entryDate": "2026-11-12",
  "description": "POS daily sales settlement",
  "lines": [
    {"accountId": 1, "debit": 1500.00, "credit": 0, "description": "Cash received"},
    {"accountId": 4, "debit": 0, "credit": 1500.00, "description": "Sales revenue"}
  ]
}
```

Success (HTTP 201):

```json
{"success":true,"data":{"id":25,"referenceNumber":"POS-SALE-2026-000123","entryDate":"2026-11-12","status":"posted","totalDebit":"1500.00","totalCredit":"1500.00"}}
```

### 5. Record a payment

`POST /payments`

```json
{
  "paymentType": "received",
  "paymentMethod": "cash",
  "amount": 1500.00,
  "paymentDate": "2026-11-12",
  "paymentReference": "POS-OR-000123",
  "notes": "POS cash sale"
}
```

`paymentType`: `received` or `paid`. `paymentMethod`: `cash`, `bank`, or `e-wallet`. Amount must be greater than zero. Success returns HTTP 201 and the created payment summary.

## Common error format

```json
{"success":false,"error":{"code":"UNAUTHORIZED","message":"A valid Bearer token is required."}}
```

Common status codes: `400` invalid input/unbalanced posting, `401` missing or invalid token, `409` duplicate journal reference, `503` missing API/service-user configuration or unavailable database, `500` unexpected server error.

## POS server-to-server example (Node.js)

```js
const API_BASE_URL = process.env.ACCOUNTING_API_BASE_URL;
const API_TOKEN = process.env.ACCOUNTING_API_TOKEN;

export async function getAccountingAccounts() {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Accounting API request failed");
  return result.data;
}
```

## Database ownership and deployment agreement

- Accounting owns its `Users`, `accounts`, `customers`, `suppliers`, `invoices`, `invoice_items`, `payments`, `expenses`, `journal_entries`, and `journal_entry_lines` tables as defined by this project.
- Other modules must call the API; they must not write directly to Accounting-owned tables or run schema migrations against them.
- `customers` is currently an Accounting-local customer table in this codebase. If Customer Logs is the authoritative customer owner, agree on a canonical customer ID and migration/synchronization contract before linking cross-module customer records. Do not silently assume the IDs match.
- This starter API does not yet implement customer/supplier foreign-key mapping on POS payment writes, inventory posting rules, or a complete sale-to-ledger accounting policy. Agree on account mapping, tax treatment, refunds, voids, and idempotency rules with the Accounting team before production use.
- Run the Accounting service on a host reachable by the other module servers. Restrict inbound traffic to trusted module hosts, use HTTPS outside local development, keep secrets out of source control, and use a persistent production session store for the web UI.

## Run locally

1. Copy `.env.example` to `.env` and set the database values, a unique `API_BEARER_TOKEN`, and a valid active `API_SERVICE_USER_ID`.
2. This project does not currently auto-load `.env`; export variables in your shell or configure them in your process manager/IDE before starting Node.
3. Install dependencies with `npm install`, then run `npm run migrate` and `npm start`.
4. Test `GET http://localhost:3000/api/v1/accounting/health`, then call an authenticated endpoint with the Bearer token.

For a different computer on the same network, replace `localhost` in the consuming module's base URL with the Accounting server's LAN hostname/IP and ensure the port is reachable. Do not expose the development server directly to the public internet.
