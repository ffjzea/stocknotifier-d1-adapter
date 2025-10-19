# stocknotifier-d1-adapter

Cloudflare Worker + D1 adapter for stockNotifier

## Quickstart

1. Fill `wrangler.toml` with your `account_id` and DB name.
2. Install tools:

```powershell
cd d1-worker
npm ci
npm install -g wrangler
```

3. Create D1 DB in Cloudflare and run migrations:

```powershell
npx wrangler d1 execute --binding=DB migrations/001_create_orders.sql
npx wrangler d1 execute --binding=DB migrations/002_create_indicator_analysis.sql
```

4. Publish:

```powershell
npx wrangler publish
```
