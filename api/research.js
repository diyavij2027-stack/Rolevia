// Company research with Google Search grounding (Gemini). Returns a structured briefing plus the web sources
// the model actually used, so the app can show links and label what is verified.
const L = require("./_lib");
const MODEL = process.env.MODEL_RESEARCH || process.env.MODEL_DEFAULT || "gemini-3.8-flash";

function extractJson(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}
const clip = (s, n) => String(s || "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);

async function resolveRedirect(uri) {
  // Grounding links are redirects through vertexaisearch; try to show the real page URL.
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(uri, { method: "GET", redirect: "manual", signal: ctl.signal }); clearTimeout(t);
    const loc = r.headers && r.headers.get && r.headers.get("location");
    return loc && /^https?:\/\//.test(loc) ? loc : uri;
  } catch (e) { return uri; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = L.env().geminiKey;
  if (!key) return res.status(503).json({ error: "AI is not configured on this site." });
  if (!L.allowedOrigin(req)) return res.status(403).json({ error: "Origin not allowed." });
  let user = null;
  if (L.backendOn()) {
    user = await L.userFromRequest(req);
    if (!user) return res.status(401).json({ error: "Please sign in again.", code: "session_expired" });
  }
  if (L.limited("rs:" + (user ? user.id : L.clientIp(req)), 20, 60 * 60 * 1000)) return res.status(429).json({ error: "Too many research requests. Try again later." });
  const body = await L.readJson(req);
  const company = clip(body && body.company, 80), role = clip(body && body.role, 60), domain = clip(body && body.domain, 60);
  if (company.length < 2) return res.status(400).json({ error: "Enter a company name." });
  if (user) {
    const t = await L.rpc("ai_touch", { p_user: user.id, p_session: null });
    if (!t.ok) return res.status(/daily_cap/.test(String(t.error)) ? 429 : 502).json({ error: /daily_cap/.test(String(t.error)) ? "Daily AI limit reached." : "Usage check failed.", code: "daily_cap" });
  }

  const prompt = `You are researching a company for a job candidate who will be interviewed there. Use Google Search and rely ONLY on what you find. Company: "${company}". ${role ? 'Target role: "' + role + '". ' : ""}${domain ? 'Industry: "' + domain + '". ' : ""}
If you cannot find a real company by this name, set "found" to false and leave the other fields empty.
Rules: never invent facts, numbers, dates, interview questions or names. If something is not supported by the search results, use null or an empty list. Prefer official sources (the company's website, careers page, annual reports, regulatory filings) and reputable news. Mention dates for recent developments (prefer the last 12 months).
Reply with ONLY this JSON:
{"found":true,"officialName":"","summary":"2 sentences on what the company does","businessModel":"how it makes money","products":["main products or services"],"culture":["culture or values the company itself states, with source type in brackets"],"recentDevelopments":[{"date":"Mon YYYY","item":"what happened"}],"roleRequirements":["skills or qualifications this company asks for in ${role || "relevant"} roles, from its job listings or careers page, if found"],"hiringProcess":"how the company says it hires, if found, else null","interviewSignals":["what candidates publicly report about interviews there, only if found, else empty"],"likelyCaseAreas":["business problems this company faces that an interviewer could turn into a case"],"limits":"one sentence on what could not be verified"}`;

  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(MODEL) + ":generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 8192 } })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: (j && j.error && j.error.message) || "Upstream error " + r.status });
    const cand = j && j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).filter(p => typeof p.text === "string" && !p.thought).map(p => p.text).join("");
    const data = extractJson(text);
    if (!data) return res.status(502).json({ error: "The research reply could not be read. Try again." });
    const gm = (cand && cand.groundingMetadata) || {};
    const chunks = (gm.groundingChunks || []).map(c => c.web).filter(w => w && w.uri);
    const seen = new Set(), uniq = [];
    for (const w of chunks) { if (seen.has(w.uri)) continue; seen.add(w.uri); uniq.push(w); if (uniq.length >= 8) break; }
    const urls = await Promise.all(uniq.map(w => resolveRedirect(w.uri)));
    const sources = uniq.map((w, i) => ({ title: clip(w.title || "", 120) || (() => { try { return new URL(urls[i]).hostname; } catch (e) { return "Source"; } })(), url: urls[i] }));
    const grounded = sources.length > 0;
    // Without any search source, nothing is presented as researched fact.
    return res.status(200).json({
      found: !!data.found && grounded,
      grounded,
      officialName: clip(data.officialName, 120) || company,
      summary: clip(data.summary, 500), businessModel: clip(data.businessModel, 500),
      products: (data.products || []).slice(0, 8).map(x => clip(x, 120)),
      culture: (data.culture || []).slice(0, 6).map(x => clip(x, 200)),
      recentDevelopments: (data.recentDevelopments || []).slice(0, 6).map(x => ({ date: clip(x && x.date, 20), item: clip(x && x.item, 240) })),
      roleRequirements: (data.roleRequirements || []).slice(0, 10).map(x => clip(x, 160)),
      hiringProcess: data.hiringProcess ? clip(data.hiringProcess, 400) : null,
      interviewSignals: (data.interviewSignals || []).slice(0, 6).map(x => clip(x, 220)),
      likelyCaseAreas: (data.likelyCaseAreas || []).slice(0, 6).map(x => clip(x, 200)),
      limits: clip(data.limits, 300),
      sources, queries: (gm.webSearchQueries || []).slice(0, 6), retrieved: new Date().toISOString().slice(0, 10)
    });
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the AI service." });
  }
};
