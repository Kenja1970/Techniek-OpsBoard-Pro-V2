import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml" };

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const path = join(root, url === "/" ? "index.html" : url.replace(/^\//, ""));
  if (!existsSync(path)) { res.writeHead(404); res.end("missing"); return; }
  res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream" });
  res.end(readFileSync(path));
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
page.on("console", (msg) => { if (msg.type() === "error") console.error("CONSOLE", msg.text()); });
await page.goto(`http://127.0.0.1:${port}/tests/qa.html`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForFunction(() => window.__QA_RESULTS && window.__QA_RESULTS.total > 0, null, { timeout: 120000 });
const results = await page.evaluate(() => window.__QA_RESULTS);
console.log(JSON.stringify(results, null, 2));
await browser.close();
server.close();
process.exit(results.failed ? 1 : 0);
