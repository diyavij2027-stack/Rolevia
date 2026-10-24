// Builds index.html from the ordered source parts in src/.
// Usage: node scripts/build.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ORDER = ["p1", "p2", "p3", "p4", "p5", "rs", "cvx", "iv", "p6", "site", "p7"];
const plans = fs.readFileSync(path.join(root, "plans.json"), "utf8").trim();
let frag = ORDER.map(n => fs.readFileSync(path.join(root, "src", n + ".html"), "utf8")).join("");
if (!frag.includes("/*PLANS_JSON*/")) { console.error("PLANS marker missing"); process.exit(1); }
frag = frag.replace("/*PLANS_JSON*/", JSON.stringify(JSON.parse(plans)));

// syntax-check every inline script
const scripts = [...frag.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { try { new vm.Script(s, { filename: "inline-script-" + i }); } catch (e) { console.error("Syntax error in inline script", i, e.message); process.exit(1); } });

// head = title/meta/link/style at the top of the fragment; body = the rest
const m = frag.match(/^((?:\s*<(?:title|meta|link)[^>]*>(?:[^<]*<\/title>)?|\s*<style>[\s\S]*?<\/style>)+)/);
if (!m) { console.error("Could not find head elements"); process.exit(1); }
const head = m[1].replace(/<meta name="claude:[^>]*>\s*/g, "");
const body = frag.slice(m[1].length);
const cfg = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
const esc = v => String(v).replace(/[^A-Za-z0-9_\-.:\/]/g, "");
const extra = [
  `<link rel="canonical" href="${esc(cfg.siteUrl)}/">`,
  `<meta property="og:type" content="website"><meta property="og:site_name" content="ROLEVIA"><meta property="og:title" content="ROLEVIA: AI interview and GD practice"><meta property="og:description" content="Company-specific, CV-based voice interview practice with strict, evidence-based feedback."><meta property="og:url" content="${esc(cfg.siteUrl)}/">`,
  `<meta name="twitter:card" content="summary">`,
  cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : "",
  cfg.clarityId ? `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${esc(cfg.clarityId)}");</script>` : ""
].filter(Boolean).join("\n");
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
fs.writeFileSync(path.join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${cfg.siteUrl}/</loc></url></urlset>\n`);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="ROLEVIA: company-specific, CV-based voice interview practice, group discussion practice and preparation tracking.">
${head}
${extra}
<script>window.ROLEVIA_SITE=true;</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="/claude-shim.js"></script>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("index.html written,", (html.length / 1024).toFixed(0), "KB,", scripts.length, "inline scripts OK");
require("./gen-plans.js");
