# OpenWA learning lab

A minimal local sandbox for evaluating [OpenWA](https://github.com/rmyndharis/OpenWA)
as a self-hosted WhatsApp gateway. Goal: learn webhooks, session lifecycle,
and Notion automation without touching the operational Acquazero number.

Context: this exists to support the
[Meta + WhatsApp Operations Mastery](https://www.notion.so/Meta-WhatsApp-Operations-Mastery-350eeae1044a81528b1acbffaecfe66f)
Phase 4 / Tier 2 evaluation.

## Safety first — read this before pairing

OpenWA uses `whatsapp-web.js`, which automates WhatsApp Web in a headless
browser. WhatsApp's Terms of Service prohibit unofficial automation.
Accounts driving high volume on unofficial stacks get banned.

**Do not pair the operational `11 96929-4859` number here.** Use a
disposable second WA number (a cheap chip ou um número reserva) for the
evaluation. If you decide to go to production, the official
[WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
or a vendor like [Z-API](https://www.z-api.io/) is the lower-risk path
for the primary lead channel.

## What's inside

- `docker-compose.yml` — OpenWA API + dashboard + a webhook-receiver service
- `webhook-handler/` — small Node.js service that verifies HMAC and logs
  inbound events; optionally upserts new leads into a Notion database
- `.env.example` — required configuration

## Run it

```bash
cp .env.example .env
# edit .env: set OPENWA_API_KEY, WEBHOOK_SECRET, optionally NOTION_*
docker compose up -d
```

Endpoints:
- OpenWA API: http://127.0.0.1:2785 (Swagger at `/api/docs`)
- Dashboard: http://127.0.0.1:2886
- Webhook receiver: http://webhook-handler:3000 (inside the compose network)

## Pair a session and wire the webhook

```bash
API=http://127.0.0.1:2785/api
KEY="$OPENWA_API_KEY"

# 1. Create a session
curl -X POST "$API/sessions" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name":"lab"}'

# 2. Start it
curl -X POST "$API/sessions/lab/start" -H "X-API-Key: $KEY"

# 3. Grab the QR (scan with the disposable WA number)
curl "$API/sessions/lab/qr" -H "X-API-Key: $KEY"

# 4. Register the webhook (compose-internal URL)
curl -X POST "$API/sessions/lab/webhooks" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d "{
    \"url\": \"http://webhook-handler:3000/webhook\",
    \"events\": [\"message.received\", \"session.status\"],
    \"secret\": \"$WEBHOOK_SECRET\"
  }"

# 5. Send a test message to yourself
curl -X POST "$API/sessions/lab/messages/send-text" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"chatId":"5511999999999@c.us","text":"hello from the lab"}'
```

## What to learn here, in order

1. Session lifecycle: create → start → QR → connected → disconnected.
2. Webhook payload shape (watch `docker compose logs -f webhook-handler`).
3. HMAC verification (handler rejects requests with a bad signature).
4. Notion automation: enable `NOTION_*` env vars to auto-create a "Leads"
   row in a Notion database on every inbound message.
5. Multi-session: create a second session (`pindaiba`, `aquicultura-conquista`)
   and confirm they run in parallel.

When you can do all five comfortably, you understand the Tier 2 toolchain
well enough to pick between OpenWA self-host vs. Z-API vs. Cloud API on
the merits.

## HMAC header

The handler expects `X-OpenWA-Signature: sha256=<hex>` where the hex is
HMAC-SHA256 of the raw request body using `WEBHOOK_SECRET`. If OpenWA's
header name turns out to be different, adjust `SIGNATURE_HEADER` in
`.env` — the exact name should be confirmed against the OpenWA source
on first run.
