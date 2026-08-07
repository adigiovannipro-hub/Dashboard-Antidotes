import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 400 } });
await p.goto("http://localhost:3100/verif-visuelle", { waitUntil: "networkidle" });
console.log(await p.evaluate(() => {
  const el = document.querySelector(".type-stat");
  const r = el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  return {
    fontSize: getComputedStyle(el).fontSize,
    boxWidth: +r.width.toFixed(1),
    boxHeight: +r.height.toFixed(1),
    lines: Math.round(r.height / (20 * 1.1)),
    textWidth: +range.getBoundingClientRect().width.toFixed(1),
  };
}));
await b.close();
