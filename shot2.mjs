import { chromium } from "@playwright/test";
const out = "/tmp/claude-0/-home-user-Dashboard-Antidotes/98356388-5ddd-5a60-8e17-7fac422012d7/scratchpad";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// --- Le champ de date : frappe et ouverture du calendrier ---
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "en-US" });
await page.addInitScript(() => {
  window.__picker = 0;
  const real = HTMLInputElement.prototype.showPicker;
  HTMLInputElement.prototype.showPicker = function () { window.__picker++; try { return real.call(this); } catch {} };
});
await page.goto("http://localhost:3100/verif-visuelle", { waitUntil: "networkidle" });

const du = page.locator('input[placeholder="JJ/MM/AAAA"]').first();
await du.click();
await du.type("05082026", { delay: 30 });
console.log("FRAPPE  → champ :", await du.inputValue());
await page.waitForTimeout(400);
console.log("URL     →", new URL(page.url()).search || "(vide)");

await page.locator('button[title="Ouvrir le calendrier"]').first().click();
console.log("CLIC CALENDRIER → showPicker appelé :", await page.evaluate(() => window.__picker), "fois");

// Saisie impossible : le champ se rétracte à la sortie
const au = page.locator('input[placeholder="JJ/MM/AAAA"]').nth(1);
await au.click(); await au.type("31022026", { delay: 20 });
await page.locator("h3, h2").first().click({ force: true }).catch(() => {});
await au.blur();
await page.waitForTimeout(200);
console.log("31/02   → après sortie du champ :", JSON.stringify(await au.inputValue()));

// L'œil
const masque = page.locator('button[title="Masquer le montant"]').first();
await masque.click();
await page.waitForTimeout(200);
console.log("ŒIL     → cookie :", (await page.context().cookies()).filter(c => c.name === "antidotes_cash_hidden").map(c => c.value).join() || "(aucun)");
await page.screenshot({ path: `${out}/verif-interaction.png`, clip: { x: 0, y: 700, width: 1280, height: 200 } });

// --- Mode sombre ---
const dark = await browser.newPage({ viewport: { width: 1280, height: 780 }, colorScheme: "dark" });
await dark.goto("http://localhost:3100/verif-visuelle", { waitUntil: "networkidle" });
await dark.evaluate(() => document.documentElement.classList.add("dark"));
await dark.waitForTimeout(600);
await dark.screenshot({ path: `${out}/verif-sombre.png`, clip: { x: 0, y: 190, width: 1280, height: 500 } });

// --- Mobile ---
const mob = await browser.newPage({ viewport: { width: 390, height: 1600 } });
await mob.goto("http://localhost:3100/verif-visuelle", { waitUntil: "networkidle" });
await mob.waitForTimeout(600);
await mob.screenshot({ path: `${out}/verif-mobile.png`, fullPage: true });
console.log("Débordement horizontal mobile :", await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1));

await browser.close();
