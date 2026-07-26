import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { extname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const path = join(root, url === "/" ? "index.html" : url.replace(/^\//, ""));
  if (!existsSync(path)) { res.writeHead(404); res.end("x"); return; }
  res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
mkdirSync(join(root, "scripts", "shots"), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
page.on("pageerror", (e) => console.error("PAGEERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);

async function nav(rx) {
  const items = await page.$$("#nav *");
  for (const n of items) { const t = (await n.innerText().catch(() => "")) || ""; if (rx.test(t)) { await n.click(); return true; } }
  return false;
}

// Manager Report
await nav(/Manager Report/i);
await page.waitForTimeout(900);
await page.screenshot({ path: join(root, "scripts", "shots", "manager-report.png"), fullPage: true });

// Client Report (Project Workspace -> Reports tab)
await nav(/Project Workspace/i);
await page.waitForTimeout(700);
const tabs = await page.$$("button");
for (const b of tabs) { const t = (await b.innerText().catch(() => "")) || ""; if (t.trim() === "Reports") { await b.click(); break; } }
await page.waitForTimeout(900);
await page.screenshot({ path: join(root, "scripts", "shots", "client-report.png"), fullPage: true });

// Gantt
await nav(/Gantt/i);
await page.waitForTimeout(900);
await page.screenshot({ path: join(root, "scripts", "shots", "gantt.png"), fullPage: false });

await browser.close();
server.close();
console.log("report shots written");
