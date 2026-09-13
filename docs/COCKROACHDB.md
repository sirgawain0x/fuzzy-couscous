# CockroachDB setup

Creative Bank uses the Node.js `pg` driver via [`lib/cockroachdb.ts`](../lib/cockroachdb.ts). Set a single env var:

```bash
COCKROACHDB_URL=postgresql://gawain:<PASSWORD>@<cluster-host>.cockroachlabs.cloud:26257/creative-finance?sslmode=verify-full
```

Copy the **General Connection String** from Cockroach Cloud (Connect → database `creative-finance`, user `gawain`). Do not use the CockroachDB Client tab.

## IP allowlist (Cockroach Cloud → Networking)

| Source | CIDR / action |
|--------|----------------|
| Local dev | Add your current public IP (or “Add my IP” in Console) |
| Vercel serverless | Allow `0.0.0.0/0`, or restrict to [Vercel Static IPs](https://vercel.com/docs/connectivity/static-ip) |

Without allowlist entries, connections time out or fail even when `COCKROACHDB_URL` is correct.

## Schema migration (fresh cluster)

Local:

```bash
pnpm db:migrate
```

Or via API in development:

```bash
curl -X POST http://localhost:3000/api/db/migrate
```

Production (requires `MIGRATION_SECRET`):

```bash
curl -X POST https://bank.creativeplatform.xyz/api/db/migrate \
  -H "x-migration-secret: $MIGRATION_SECRET"
```

## Vercel

Project: `creative-projects/bank`. Update `COCKROACHDB_URL` for Production, Preview, and Development in [Vercel env settings](https://vercel.com/creative-projects/bank/settings/environment-variables), then redeploy.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `cluster … not found` | Hostname is from a deleted cluster — copy a fresh General Connection String from the new cluster Connect page |
| Connection timeout | Add your IP (and Vercel egress) to Cockroach Cloud allowlist |
| `COCKROACHDB_URL is required` | Set the env var locally or on Vercel and redeploy |
