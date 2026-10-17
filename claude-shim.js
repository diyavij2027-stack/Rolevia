/* Provides the small `window.claude` surface the ROLEVIA app expects, for the standalone website.
   - sample    -> POST /api/ai (server-side proxy; your API key never reaches the browser)
   - downloads -> saves a file through a normal browser download
   - db, room, user -> not available on the website (returns null), so group GD shows an honest
     "needs a shared database" message instead of pretending to work. */
(function () {
  /* Public config (Supabase URL + anon key, payments flag). Fetched synchronously once so the app boots with the right mode. */
  if (!window.ROLEVIA_CFG) try {
    var x = new XMLHttpRequest(); x.open("GET", "/api/config", false); x.send(null);
    if (x.status === 200) window.ROLEVIA_CFG = JSON.parse(x.responseText);
  } catch (e) {}
  window.ROLEVIA_CFG = window.ROLEVIA_CFG || { backend: false, payments: false };
  var aiReady;
  function aiAvailable() {
    if (aiReady) return aiReady;
    aiReady = fetch("/api/ai", { method: "GET", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .then(function (j) { return !!(j && j.ok); })
      .catch(function () { return false; });
    return aiReady;
  }
  function err(code, message, text) { var e = new Error(message || code); e.code = code; if (text) e.text = text; return e; }

  async function call(prompt, opts) {
    opts = opts || {};
    var body = { tier: opts.modelTier || "default", json: !!opts.json };
    if (typeof prompt === "string") body.prompt = prompt; else body.messages = prompt;
    var r;
    try {
      var headers = { "content-type": "application/json" };
      if (window.ROLEVIA_AUTH) { var tk = await window.ROLEVIA_AUTH.token(); if (tk) headers.authorization = "Bearer " + tk; }
      if (opts.sessionId) body.sessionId = opts.sessionId;
      r = await fetch("/api/ai", { method: "POST", headers: headers, body: JSON.stringify(body), signal: opts.signal });
    } catch (e) {
      if (e && e.name === "AbortError") throw err("cancelled", "Cancelled");
      throw err("upstream_error", "Network error");
    }
    if (r.status === 429 && !opts._retried) { await new Promise(function (ok) { setTimeout(ok, 5000); }); return call(prompt, Object.assign({}, opts, { _retried: true })); }
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      var code = (j && j.code) || (r.status === 401 ? "session_expired" : r.status === 429 ? "rate_limited" : r.status === 503 ? "unavailable" : "upstream_error");
      throw err(code, (j && j.error) || "HTTP " + r.status);
    }
    return j;
  }

  function extractJson(text) {
    var t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    try { return JSON.parse(t); } catch (e) {}
    var a = t.search(/[\[{]/); if (a < 0) throw err("invalid_json", "No JSON in reply", text);
    var open = t[a], close = open === "{" ? "}" : "]", b = t.lastIndexOf(close);
    if (b <= a) throw err("invalid_json", "Incomplete JSON", text);
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { throw err("invalid_json", "Invalid JSON", text); }
  }

  function makeSample() {
    var sample = async function (input, opts) { var j = await call(input, opts); return { text: j.text, truncated: !!j.truncated }; };
    sample.json = async function (input, opts) { var j = await call(input, Object.assign({}, opts, { json: true })); return extractJson(j.text); };
    sample.limits = async function () { return { images: false }; };
    return sample;
  }

  function makeDownloads() {
    return {
      save: async function (o) {
        var data = o.data, blob = data instanceof Blob ? data : new Blob([data], { type: o.type || "application/octet-stream" });
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = o.filename || "download";
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        return { saved: true };
      }
    };
  }

  window.claude = {
    use: async function (name) {
      if (name === "sample") return (await aiAvailable()) ? makeSample() : null;
      if (name === "downloads") return makeDownloads();
      return null; // db, room, user, ...
    }
  };
})();
