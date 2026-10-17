// Serverless proxy to the Anthropic Messages API (Vercel Node runtime).
// Keeps ANTHROPIC_API_KEY on the server and adds basic abuse limits.
const MODELS = {
  quick: process.env.MODEL_QUICK || "claude-haiku-5-5",
  default: process.env.MODEL_DEFAULT || "claude-sonnet-5-5",
  complex: process.env.MODEL_COMPLEX || "claude-opus-5-5"
};
const MAX_CHARS = 60000;          // prompt size cap
const MAX_TOKENS = 4096;          // output cap
const WINDOW_MS = 10 * 60 * 1000;  // rate window
const MAX_REQ = Number(process.env.RATE_LIMIT_PER_10MIN || 40);
const hits = new Map();           // best-effort, per warm instance

function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return arr.length > MAX_REQ;
}
function allowedOrigin(req) {
  const list = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!list.length) return true;
  const o = req.headers.origin || "";
  return list.includes(o);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === "GET") return res.status(200).json({ ok: !!key });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!key) return res.status(503).json({ error: "AI is not configured on this site." });
  if (!allowedOrigin(req)) return res.status(403).json({ error: "Origin not allowed." });
  const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket.remoteAddress || "unknown").trim();
  if (limited(ip)) return res.status(429).json({ error: "Too many requests. Try again in a few minutes." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid request." });

  let messages;
  if (typeof body.prompt === "string") messages = [{ role: "user", content: body.prompt }];
  else if (Array.isArray(body.messages)) messages = body.messages.map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "") }));
  else return res.status(400).json({ error: "Missing prompt." });
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (!total || total > MAX_CHARS) return res.status(413).json({ error: "Prompt is empty or too long." });
  if (messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "Last message must be from the user." });

  const model = MODELS[body.tier] || MODELS.default;
  const payload = { model, max_tokens: MAX_TOKENS, messages };
  if (body.json) payload.system = "You are a backend for a web app. Reply with a single valid JSON value only: no prose, no markdown fences.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const status = r.status === 429 ? 429 : 502;
      return res.status(status).json({ error: (j && j.error && j.error.message) || "Upstream error " + r.status });
    }
    const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return res.status(200).json({ text, truncated: j.stop_reason === "max_tokens" });
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the AI service." });
  }
};
