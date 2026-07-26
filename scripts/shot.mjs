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
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("pageerror", (e) => console.error("PAGEERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
// Go to Kanban board view via sidebar nav
const nav = await page.$$("#nav *");
for (const n of nav) { const t = (await n.innerText().catch(() => "")) || ""; if (/Kanban Board/i.test(t)) { await n.click(); break; } }
await page.waitForTimeout(900);
// Clear any residual board filter left by the boot-time import.
const clr = await page.$$("a, button, span");
for (const c of clr) { const t = (await c.innerText().catch(() => "")) || ""; if (t.trim() === "Clear") { await c.click().catch(() => {}); break; } }
await page.waitForTimeout(700);
const diag = await page.evaluate(() => {
  var Q = window.TechniekOpsBoard && window.TechniekOpsBoard._qa;
  var s = Q && Q.state();
  return { cards: s ? s.cards.length : -1, activeBoard: s ? s.activeBoardId : null, domCards: document.querySelectorAll(".card").length };
});
console.log("DIAG", JSON.stringify(diag));
await page.screenshot({ path: join(root, "scripts", "shots", "board.png"), fullPage: false });
// Open first card editor
const card = await page.$(".card");
if (card) {
  await card.click(); await page.waitForTimeout(700);
  await page.screenshot({ path: join(root, "scripts", "shots", "editor.png"), fullPage: false });
  const te = await page.$(".team-editor");
  if (te) {
    await te.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await page.screenshot({ path: join(root, "scripts", "shots", "team-editor.png"), fullPage: false });
    // Open the searchable picker and type to show live filtering
    const inp = await page.$(".team-editor .res-combo-input");
    if (inp) { await inp.click(); await inp.fill("engineer"); await page.waitForTimeout(400); await page.screenshot({ path: join(root, "scripts", "shots", "team-search.png"), fullPage: false }); }
  }
}
await browser.close();
server.close();
console.log("shots written");
