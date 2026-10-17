// Builds index.html from the ordered source parts in src/.
// Usage: node scripts/build.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ORDER = ["p1", "p2", "p3", "p4", "p5", "rs", "cvx", "iv", "p6", "p7"];
const frag = ORDER.map(n => fs.readFileSync(path.join(root, "src", n + ".html"), "utf8")).join("");

// syntax-check every inline script
const scripts = [...frag.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { try { new vm.Script(s, { filename: "inline-script-" + i }); } catch (e) { console.error("Syntax error in inline script", i, e.message); process.exit(1); } });

// head = title/meta/link/style at the top of the fragment; body = the rest
const m = frag.match(/^((?:\s*<(?:title|meta|link)[^>]*>(?:[^<]*<\/title>)?|\s*<style>[\s\S]*?<\/style>)+)/);
if (!m) { console.error("Could not find head elements"); process.exit(1); }
const head = m[1].replace(/<meta name="claude:[^>]*>\s*/g, "");
const body = frag.slice(m[1].length);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="ROLEVIA: company-specific, CV-based voice interview practice, group discussion practice and preparation tracking.">
${head}
<script>window.ROLEVIA_SITE=true;</script>
<script src="/claude-shim.js"></script>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("index.html written,", (html.length / 1024).toFixed(0), "KB,", scripts.length, "inline scripts OK");
