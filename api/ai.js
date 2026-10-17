// Serverless proxy to the Google Gemini API (Vercel Node runtime).
// Keeps GEMINI_API_KEY on the server and adds basic abuse limits.
// Default models are ones listed as free-tier on https://ai.google.dev/gemini-api/docs/pricing.
const MODELS = {
  quick: process.env.MODEL_QUICK || "gemini-3.5-flash-lite",
  default: process.env.MODEL_DEFAULT || "gemini-3.8-flash",
  complex: process.env.MODEL_COMPLEX || "gemini-3.8-flash"
};
const L = require("./_lib");
const MAX_CHARS = 60000;          // prompt size cap
const MAX_TOKENS = 8192;          // output cap (thinking models spend part of this on reasoning)

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = L.env().geminiKey;
  if (req.method === "GET") {
    // Diagnostics: never returns the key itself.
    const named = Object.keys(process.env).filter(k => /gemini|google|api_?key/i.test(k) && k !== "GEMINI_API_KEY" && k !== "GOOGLE_API_KEY");
    let hint = "";
    if (!key) hint = named.length
      ? "No GEMINI_API_KEY here, but similarly named variables exist: " + named.join(", ") + ". The name must be exactly GEMINI_API_KEY."
      : "GEMINI_API_KEY is not set for this deployment (" + (process.env.VERCEL_ENV || "unknown env") + "). Add it in Settings > Environment Variables with this environment ticked, then redeploy.";
    else if (!/^AIza/.test(key)) hint = "A key is set but it does not look like a Google AI Studio key (should start with AIza).";
    return res.status(200).json({ ok: !!key, backend: L.backendOn(), vercelEnv: process.env.VERCEL_ENV || null, keyFormatLooksRight: key ? /^AIza[\w-]{30,}$/.test(key) : null, hint });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!key) return res.status(503).json({ error: "AI is not configured on this site." });
  if (!L.allowedOrigin(req)) return res.status(403).json({ error: "Origin not allowed." });

  // With the backend on, every AI call needs a signed-in user and passes the server-side usage gate.
  let user = null;
  if (L.backendOn()) {
    user = await L.userFromRequest(req);
    if (!user) return res.status(401).json({ error: "Please sign in again.", code: "session_expired" });
  }
  if (L.limited("ip:" + L.clientIp(req), Number(process.env.RATE_LIMIT_PER_10MIN || 60), 10 * 60 * 1000)) return res.status(429).json({ error: "Too many requests. Try again in a few minutes." });

  const body = await L.readJson(req);
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Invalid request." });

  let turns;
  if (typeof body.prompt === "string") turns = [{ role: "user", content: body.prompt }];
  else if (Array.isArray(body.messages)) turns = body.messages.map(m => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.content) || "") }));
  else return res.status(400).json({ error: "Missing prompt." });
  const total = turns.reduce((n, m) => n + m.content.length, 0);
  if (!total || total > MAX_CHARS) return res.status(413).json({ error: "Prompt is empty or too long." });
  if (turns[turns.length - 1].role !== "user") return res.status(400).json({ error: "Last message must be from the user." });

  if (user) {
    const sid = typeof body.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(body.sessionId) ? body.sessionId : null;
    const t = await L.rpc("ai_touch", { p_user: user.id, p_session: sid });
    if (!t.ok) {
      const code = String(t.error || "");
      if (/daily_cap/.test(code)) return res.status(429).json({ error: "Daily AI limit reached. Try again tomorrow.", code: "daily_cap" });
      if (/session_cap/.test(code)) return res.status(403).json({ error: "This session reached its AI limit.", code: "session_cap" });
      if (/session_closed/.test(code)) return res.status(403).json({ error: "This session is already finished.", code: "session_closed" });
      if (/bad_session/.test(code)) return res.status(403).json({ error: "Unknown session.", code: "bad_session" });
      return res.status(502).json({ error: "Usage check failed.", code: "usage_check" });
    }
  }

  const model = MODELS[body.tier] || MODELS.default;
  const payload = {
    contents: turns.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: MAX_TOKENS }
  };
  if (body.json) {
    payload.systemInstruction = { parts: [{ text: "You are a backend for a web app. Reply with a single valid JSON value only: no prose, no markdown fences." }] };
    payload.generationConfig.responseMimeType = "application/json";
  }

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const status = r.status === 429 ? 429 : 502;
      return res.status(status).json({ error: (j && j.error && j.error.message) || "Upstream error " + r.status });
    }
    if (j && j.promptFeedback && j.promptFeedback.blockReason) return res.status(502).json({ error: "The AI declined this request (" + j.promptFeedback.blockReason + ")." });
    const cand = j && j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).filter(p => typeof p.text === "string" && !p.thought).map(p => p.text).join("");
    if (!text) return res.status(502).json({ error: "The AI returned an empty reply." + (cand && cand.finishReason ? " (" + cand.finishReason + ")" : "") });
    return res.status(200).json({ text, truncated: !!(cand && cand.finishReason === "MAX_TOKENS") });
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the AI service." });
  }
};
