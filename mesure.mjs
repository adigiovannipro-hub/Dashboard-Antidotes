import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 400 } });
await p.goto("http://localhost:3100/verif-visuelle", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
const r = await p.evaluate(() => {
  const card = document.querySelector(".type-stat")?.parentElement?.parentElement;
  const inner = card ? card.getBoundingClientRect().width - 40 : 0;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-weight:600;font-family:var(--font-heading)";
  document.body.append(probe);
  const out = {};
  for (const size of [28, 24, 22, 20, 18]) {
    probe.style.fontSize = size + "px";
    probe.textContent = "8 742,19 €";
    const a = probe.getBoundingClientRect().width;
    probe.textContent = "128 742,19 €";
    const big = probe.getBoundingClientRect().width;
    out[size] = { "8k": +a.toFixed(0), "128k": +big.toFixed(0) };
  }
  return { innerWidth: +inner.toFixed(0), out };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
