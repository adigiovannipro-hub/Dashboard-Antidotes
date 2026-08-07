import { chromium } from "@playwright/test";
const out = "/tmp/claude-0/-home-user-Dashboard-Antidotes/98356388-5ddd-5a60-8e17-7fac422012d7/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 400 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:3100/verif-visuelle", { waitUntil: "networkidle" });
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/crop-cartes.png`, clip: { x: 0, y: 0, width: 390, height: 220 } });
await b.close();
