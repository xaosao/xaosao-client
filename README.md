# xaosao-client

## Scripts

One-shot scripts in `scripts/` for database seeding and migrations.
Run from this directory (`xaosao-client/`).

| Script | Command | When to run | What it does |
|---|---|---|---|
| `seed-payment-qr-code.ts` | `bun run seed:payment-qr` | After first deploy + any time the QR image changes | Upserts `system_config[payment_qr_code]` with the CDN URL. Falls back to `/images/qr-code.jpeg` if missing. |
| `migrate-model-phone-verified.ts` | `bun run migrate:phone-verified` | Once before deploying `isPhoneVerified` login gate | Backfills `isPhoneVerified=true` on existing models so they aren't locked out. |

---

## Payment QR Code

The payment QR code shown on the customer top-up page (`/customer/wallets/top-up`) is stored in the `system_config` collection under `key = "payment_qr_code"`.

### First deploy — insert the record

```bash
# Replace the URL with your actual CDN link
QR_CODE_URL="https://xaosao-local.b-cdn.net/your-qr-code.png" bun run seed:payment-qr
```

### Update the QR code later

Upload the new image to your CDN, copy the URL, then run the same command with the new URL:

```bash
QR_CODE_URL="https://xaosao-local.b-cdn.net/new-qr-code.png" bun run seed:payment-qr
```

The script is **idempotent** — safe to run multiple times. It uses `upsert` so it creates the record if missing, or updates the URL if it already exists.

### Fallback behaviour

If the `system_config` record does not exist, the top-up page falls back to the static file `/public/images/qr-code.jpeg`. This means the app won't break before you run the seed.

### API endpoint

The QR code URL is also accessible via xs_backend:

```
GET /api/v1/system/payment-qr-code   (public, no auth)
```

Response:
```json
{
  "data": {
    "url": "https://your-cdn.b-cdn.net/qr-code.png",
    "description": "Payment QR code image shown in the customer top-up flow"
  }
}
```
