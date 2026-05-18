import crypto from "node:crypto";
import express from "express";

const {
  PORT = "3000",
  WEBHOOK_SECRET,
  SIGNATURE_HEADER = "x-openwa-signature",
  NOTION_TOKEN,
  NOTION_LEADS_DATABASE_ID,
} = process.env;

if (!WEBHOOK_SECRET) {
  console.error("WEBHOOK_SECRET is required");
  process.exit(1);
}

const app = express();
app.use(express.raw({ type: "*/*", limit: "5mb" }));

function verify(rawBody, headerValue) {
  if (!headerValue) return false;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const provided = headerValue.replace(/^sha256=/, "");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(provided, "hex"),
  );
}

async function pushLeadToNotion({ phone, name, text }) {
  if (!NOTION_TOKEN || !NOTION_LEADS_DATABASE_ID) return;
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_LEADS_DATABASE_ID },
      properties: {
        Name: { title: [{ text: { content: name || phone } }] },
        Phone: { rich_text: [{ text: { content: phone } }] },
        "Last message": { rich_text: [{ text: { content: text.slice(0, 1900) } }] },
        Source: { select: { name: "WhatsApp" } },
      },
    }),
  });
  if (!res.ok) {
    console.error("Notion push failed", res.status, await res.text());
  }
}

app.post("/webhook", async (req, res) => {
  const ok = verify(req.body, req.header(SIGNATURE_HEADER));
  if (!ok) {
    console.warn("rejected: bad signature");
    return res.status(401).send("bad signature");
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).send("bad json");
  }

  console.log(JSON.stringify({ at: new Date().toISOString(), payload }, null, 2));

  const event = payload?.event ?? payload?.type;
  const msg = payload?.data ?? payload?.message ?? payload;
  if (event === "message.received" && msg?.from && !msg.fromMe) {
    const phone = String(msg.from).replace(/@c\.us$/, "");
    const name = msg.notifyName || msg.pushname || msg.contact?.name;
    const text = msg.body || msg.text || "";
    try {
      await pushLeadToNotion({ phone, name, text });
    } catch (err) {
      console.error("notion error", err);
    }
  }

  res.status(204).end();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(Number(PORT), () => {
  console.log(`webhook-handler listening on :${PORT}`);
});
