const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const A = path.resolve(__dirname, "../assets");

const OR = "E45728", BR = "922D18", CR = "F6EBDA", YE = "FEBE5C", WH = "FFFFFF", INK = "3B1B0F", SAND = "FBF6EC", MUTE = "7A5A4A", GREEN = "4E7A3A";
const HF = "Fredoka", BF = "Lato";
const W = 13.333, H = 7.5;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Alessandro Di Giovanni";
pres.title = "Chasseurs de Graines — Bilan 2025-2026 & cap 2027";

const img = (n) => path.join(A, n);
const has = (n) => fs.existsSync(img(n));

function text(slide, t, o) {
  slide.addText(t, Object.assign({ isTextBox: true, fontFace: BF, color: INK, margin: 0, valign: "top" }, o));
}
function pill(slide, label, x, y, w, h, fill, color, size) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: h / 2 });
  slide.addText(label, { x, y, w, h, isTextBox: true, fontFace: HF, fontSize: size || 12, bold: true, color: color || WH, align: "center", valign: "middle", margin: 0, charSpacing: 1 });
}
function title(slide, t, opts) {
  const o = opts || {};
  text(slide, t, { x: 0.6, y: 0.45, w: o.w || 8.5, h: 0.9, fontFace: HF, fontSize: o.size || 34, bold: true, color: o.color || BR, valign: "middle" });
}
function kicker(slide, t, color) {
  pill(slide, t, 0.6, 0.2, 2.4 + t.length * 0.05, 0.3, color || OR, WH, 9.5);
}
function footer(slide, src, dark) {
  text(slide, src, { x: 0.6, y: 7.05, w: 10.5, h: 0.3, fontSize: 8.5, color: dark ? "E9D6C4" : MUTE, italic: true, valign: "middle" });
  slide.addImage({ path: img(dark ? "ChasseursDeGraines_Logo_Blanc.png" : "ChasseursDeGraines_Logo_Quadri.png"), x: 11.55, y: 6.85, w: 1.3, h: 0.63 });
}
function phone(slide, imgName, x, y, w) {
  // iPhone-like frame, screen ratio 9:19.5
  const h = w * 2.05;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: "1C1410" }, line: { color: "1C1410" }, rectRadius: 0.32, shadow: { type: "outer", color: "000000", blur: 10, offset: 4, angle: 90, opacity: 0.25 } });
  const bz = 0.07;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + bz, y: y + bz, w: w - 2 * bz, h: h - 2 * bz, fill: { color: WH }, line: { color: "1C1410" }, rectRadius: 0.26 });
  slide.addImage({ path: img(imgName), x: x + bz, y: y + bz, w: w - 2 * bz, h: h - 2 * bz, sizing: { type: "cover", w: w - 2 * bz, h: h - 2 * bz }, rounding: false });
  // island
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + w * 0.35, y: y + 0.14, w: w * 0.3, h: 0.11, fill: { color: "1C1410" }, line: { color: "1C1410" }, rectRadius: 0.055 });
}
function laptop(slide, x, y, w, drawScreen) {
  const sh = w * 0.6;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: sh, fill: { color: "1C1410" }, line: { color: "1C1410" }, rectRadius: 0.16, shadow: { type: "outer", color: "000000", blur: 10, offset: 4, angle: 90, opacity: 0.22 } });
  const bz = 0.09;
  slide.addShape(pres.shapes.RECTANGLE, { x: x + bz, y: y + bz, w: w - 2 * bz, h: sh - 2 * bz, fill: { color: WH }, line: { color: WH } });
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - w * 0.06, y: y + sh, w: w * 1.12, h: 0.16, fill: { color: "D8D3CC" }, line: { color: "D8D3CC" }, rectRadius: 0.06 });
  slide.addShape(pres.shapes.RECTANGLE, { x: x + w * 0.4, y: y + sh, w: w * 0.2, h: 0.05, fill: { color: "B9B3AA" }, line: { color: "B9B3AA" } });
  drawScreen(x + bz, y + bz, w - 2 * bz, sh - 2 * bz);
}
function card(slide, x, y, w, h, fill) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill || WH }, line: { color: fill || WH }, rectRadius: 0.18, shadow: { type: "outer", color: "5A3A28", blur: 8, offset: 2, angle: 90, opacity: 0.10 } });
}
function stat(slide, x, y, w, h, big, label, sub, opts) {
  const o = opts || {};
  card(slide, x, y, w, h, o.fill);
  const bh = o.bigH || 0.5;
  text(slide, big, { x: x + 0.25, y: y + 0.12, w: w - 0.5, h: bh, fontFace: HF, fontSize: o.bigSize || 30, bold: true, color: o.bigColor || OR, valign: "middle" });
  text(slide, label, { x: x + 0.25, y: y + 0.12 + bh, w: w - 0.5, h: 0.3, fontSize: 11, bold: true, color: o.color || BR, valign: "middle" });
  if (sub) text(slide, sub, { x: x + 0.25, y: y + 0.12 + bh + 0.32, w: w - 0.5, h: h - bh - 0.5, fontSize: 9.3, color: o.subColor || MUTE, valign: "top", lineSpacingMultiple: 1.05 });
}
function bullets(slide, items, x, y, w, h, o) {
  o = o || {};
  const arr = items.map((it, i) => ({ text: it, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: o.gap || 6 } }));
  slide.addText(arr, { x, y, w, h, isTextBox: true, fontFace: BF, fontSize: o.size || 12, color: o.color || INK, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
}
const chartBase = {
  chartColors: [OR, BR, YE, GREEN],
  catAxisLabelColor: MUTE, valAxisLabelColor: MUTE, catAxisLabelFontFace: BF, valAxisLabelFontFace: BF,
  catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
  valGridLine: { color: "E6D9C8", size: 0.5 }, catGridLine: { style: "none" },
  legendFontFace: BF, legendFontSize: 9.5, legendColor: INK, legendPos: "b",
  plotArea: { fill: { color: WH } }, chartArea: { fill: { color: WH } },
  dataLabelFontFace: BF, dataLabelFontSize: 8.5, dataLabelColor: INK,
};

// ---------------------------------------------------------------- 1. COVER
{
  const s = pres.addSlide();
  s.background = { color: CR };
  // décor : grands arcs blancs façon créa
  s.addShape(pres.shapes.OVAL, { x: -2.2, y: 4.6, w: 9, h: 6, fill: { color: WH }, line: { color: WH } });
  s.addShape(pres.shapes.OVAL, { x: 9.5, y: -2.6, w: 5.5, h: 5.5, fill: { color: WH }, line: { color: WH } });
  s.addImage({ path: img("ChasseursDeGraines_Logo_Quadri.png"), x: 0.55, y: 0.45, w: 2.6, h: 1.25 });
  pill(s, "ANMF · CHASSEURS DE GRAINES", 0.65, 2.05, 3.55, 0.36, BR, WH, 10.5);
  text(s, "Bilan 2025-2026", { x: 0.6, y: 2.55, w: 6.6, h: 1.0, fontFace: HF, fontSize: 46, bold: true, color: BR });
  text(s, "& cap 2027", { x: 0.6, y: 3.45, w: 6.6, h: 1.0, fontFace: HF, fontSize: 46, bold: true, color: OR });
  text(s, "Ce que les réseaux, la médiatisation et le site ont produit, et ce qu'on arrête, garde et ajoute pour aller plus loin.", { x: 0.6, y: 4.6, w: 5.6, h: 0.9, fontSize: 14, color: INK, lineSpacingMultiple: 1.15 });
  text(s, "Septembre 2026 · Alessandro Di Giovanni", { x: 0.6, y: 6.7, w: 6, h: 0.35, fontSize: 10.5, color: MUTE });
  // mockups
  phone(s, "GRAIN_DE_VERIT_1.jpg", 7.6, 1.15, 2.05);
  phone(s, "T_ES_PLUT_T_1_.jpg", 10.15, 2.35, 2.05);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.05, y: 4.95, w: 1.9, h: 2.37, fill: { color: WH }, line: { color: WH }, rectRadius: 0.16, shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 90, opacity: 0.2 } });
  s.addImage({ path: img("UNPOPULAR_OPINION.jpg"), x: 9.12, y: 5.02, w: 1.76, h: 2.2 });
  s.addNotes("Deck de bilan pour préparer la reconduction 2027. Sources : GA4 (propriété chasseursdegraines.fr), API Meta Ads (compte ANMF), reportings mensuels Looker 2025 et juin 2026, board Monday PE 2025/2026, relevés d'abonnés de fin de mois.");
}

// ---------------------------------------------------------------- 2. CE QU'ON A CONSTRUIT
{
  const s = pres.addSlide();
  s.background = { color: SAND };
  s.addImage({ path: img("2025_04_17_chasseurs-de-graines-14.jpg"), x: 0, y: 0, w: 4.6, h: H, sizing: { type: "cover", w: 4.6, h: H } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.9, w: 4.6, h: 1.6, fill: { color: BR, transparency: 15 }, line: { color: BR, transparency: 15 } });
  text(s, "Shooting 2025 · banque d'images Chasseurs de Graines", { x: 0.3, y: 6.55, w: 4.1, h: 0.4, fontSize: 9, color: WH, italic: true });
  text(s, "Ce qu'on a construit", { x: 5.0, y: 0.45, w: 7.8, h: 0.9, fontFace: HF, fontSize: 34, bold: true, color: BR, valign: "middle" });
  // reposition kicker to the right column
  pill(s, "2 ANS DE CAMPAGNE", 5.0, 0.2, 2.2, 0.3, OR, WH, 9.5);

  const cols = [
    { yr: "2025", tone: BR, items: ["Lancement TikTok : 0 → 464 abonnés en 8 mois", "Première campagne d'influence (2 créateurs)", "4 nouveaux piliers de contenus testés", "Dark ads Meta + TikTok : 3 300 € HT", "Trafic site ×10 sur les mois de campagne"] },
    { yr: "2026", tone: OR, items: ["Nouvelle DA + claim, comptes remis à jour", "16 à 18 publications / mois tenues depuis mars", "3 sets de stories interactives / mois", "2 jours de tournage : 20 vidéos (immersion, FAQ expert, portraits, beauty shots)", "Film de campagne 30 s + créatrice UGC"] },
  ];
  cols.forEach((c, i) => {
    const x = 5.0 + i * 3.95, y = 1.55, w = 3.75, h = 4.35;
    card(s, x, y, w, h);
    text(s, c.yr, { x: x + 0.3, y: y + 0.2, w: 2, h: 0.7, fontFace: HF, fontSize: 40, bold: true, color: c.tone, valign: "middle" });
    bullets(s, c.items, x + 0.3, y + 1.05, w - 0.6, h - 1.2, { size: 11.5, gap: 7 });
  });
  // bande de chiffres résumé
  const strip = [["+236 %", "abonnés Instagram\nfév. 2025 → juil. 2026"], ["12,6 M", "impressions payantes\nMeta + TikTok en 2025"], ["×2", "sessions sur le site\njan.-août 2026 vs 2025"]];
  strip.forEach((k, i) => {
    const x = 5.0 + i * 2.62;
    text(s, k[0], { x, y: 6.05, w: 2.5, h: 0.5, fontFace: HF, fontSize: 24, bold: true, color: OR, valign: "middle" });
    text(s, k[1], { x, y: 6.55, w: 2.5, h: 0.5, fontSize: 9, color: MUTE, lineSpacingMultiple: 1.05 });
  });
  s.addImage({ path: img("ChasseursDeGraines_Logo_Quadri.png"), x: 11.55, y: 6.85, w: 1.3, h: 0.63 });
  s.addNotes("Sources : board Monday PE 2025 et PE 2026, stratégie 2026, reportings Looker. 12,6 M = 1,02 M impressions Meta + 10,7 M TikTok Ads sur mai-nov. 2025. Sessions : 33 751 (jan.-août 2025) vs 66 215 (jan.-août 2026), GA4.");
}

// ---------------------------------------------------------------- 3. COMMUNAUTÉS
{
  const s = pres.addSlide();
  s.background = { color: CR };
  kicker(s, "LES COMMUNAUTÉS");
  title(s, "Des communautés qui grandissent, sauf X", { w: 11 });
  const months = ["fév. 25","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc.","janv. 26","fév.","mars","avr.","mai","juin","juil. 26"];
  const ig = [1042,1039,1039,1234,1418,1591,1746,1948,2292,2596,2590,2571,2558,2696,2929,3162,3295,3496];
  const tt = [null,0,1,33,82,172,267,343,454,464,457,445,438,455,517,572,702,813];
  card(s, 0.6, 1.5, 7.9, 5.35);
  text(s, "Abonnés en fin de mois · Instagram et TikTok", { x: 0.9, y: 1.65, w: 7, h: 0.35, fontSize: 12, bold: true, color: BR });
  s.addChart(pres.charts.LINE, [
    { name: "Instagram", labels: months, values: ig },
    { name: "TikTok", labels: months, values: tt.map(v => v === null ? 0 : v) },
  ], Object.assign({}, chartBase, { x: 0.75, y: 2.0, w: 7.6, h: 4.7, lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5, showLegend: true, valAxisMinVal: 0, valAxisMaxVal: 4000, catAxisLabelRotate: -45, showValue: false, chartColors: [OR, BR] }));
  const stats = [
    ["+236 %", "Instagram", "1 042 → 3 496 abonnés. Reprise nette depuis mars 2026 (+200 / mois)."],
    ["813", "TikTok", "Compte ouvert en mars 2025. Deux paliers : campagnes 2025 puis reprise avril 2026."],
    ["+27 %", "LinkedIn ANMF", "5 229 → 6 632. Croissance régulière, audience pro et prescripteurs."],
    ["1 423", "X (Twitter)", "1 429 en mars 2023. Aucun mouvement en 3 ans, 0 publication en 2026.", { bigColor: MUTE }],
  ];
  stats.forEach((k, i) => {
    const y = 1.5 + i * 1.36;
    stat(s, 8.75, y, 4.0, 1.26, k[0], k[1], k[2], Object.assign({ bigSize: 22, bigH: 0.4 }, k[3] || {}));
  });
  footer(s, "Sources : relevés d'abonnés de fin de mois (tableau ANMF I Reporting DS), fév. 2025 → juil. 2026. Facebook : 83 → 166.");
  s.addNotes("Instagram : creux nov. 2025 → fév. 2026 pendant l'inter-campagne (2 596 → 2 558), puis +938 entre mars et juillet 2026. TikTok : idem, stagnation hors campagne (464 → 438), reprise dès avril 2026.");
}

// ---------------------------------------------------------------- 4. MÉDIATISATION
{
  const s = pres.addSlide();
  s.background = { color: SAND };
  kicker(s, "LA MÉDIATISATION");
  title(s, "Plus de résultats pour moins de budget", { w: 9 });
  // Meta comparison table
  card(s, 0.6, 1.5, 6.45, 3.0);
  text(s, "Meta Ads · campagne 2025 (mai-nov.) vs 2026 (mars-août)", { x: 0.85, y: 1.62, w: 6, h: 0.35, fontSize: 12, bold: true, color: BR });
  const rows = [
    ["", "2025 · 7 mois", "2026 · 6 mois", "Évolution"],
    ["Budget", "3 275 €", "2 542 €", "−22 %"],
    ["Impressions", "1,02 M", "1,12 M", "+9 %"],
    ["Clics", "48 021", "63 472", "+32 %"],
    ["CTR", "4,69 %", "5,69 %", "+21 %"],
    ["CPM", "3,20 €", "2,28 €", "−29 %"],
    ["CPC", "0,07 €", "0,04 €", "−43 %"],
    ["Vidéos vues à 100 %", "41 384", "58 751", "+42 %"],
  ];
  const tRows = rows.map((r, ri) => r.map((c, ci) => ({ text: c, options: { fontFace: BF, fontSize: 10, bold: ri === 0 || ci === 0, color: ri === 0 ? MUTE : (ci === 3 ? OR : INK), align: ci === 0 ? "left" : "right", fill: { color: WH }, border: { type: "solid", pt: 0.5, color: "EFE4D3" }, margin: [2, 6, 2, 6] } })));
  s.addTable(tRows, { x: 0.85, y: 2.0, w: 5.95, colW: [1.9, 1.35, 1.35, 1.35], rowH: 0.29 });

  // TikTok block
  card(s, 0.6, 4.7, 6.45, 2.15, BR);
  text(s, "TikTok Ads · la machine à volume", { x: 0.85, y: 4.85, w: 6, h: 0.35, fontSize: 12, bold: true, color: YE });
  const tk = [["10,7 M", "impressions\nmai-nov. 2025"], ["0,30 €", "CPM 2025\n0,26 € en juin 2026"], ["10 302", "visites du site\ngénérées en 2025"], ["36 %", "hook rate du POV\n« tes potes en stage »"]];
  tk.forEach((k, i) => {
    const x = 0.85 + i * 1.5;
    text(s, k[0], { x, y: 5.25, w: 1.45, h: 0.55, fontFace: HF, fontSize: 24, bold: true, color: WH, valign: "middle" });
    text(s, k[1], { x, y: 5.85, w: 1.45, h: 0.8, fontSize: 9, color: "F3E3D3", lineSpacingMultiple: 1.05 });
  });
  // chart clicks per month
  card(s, 7.3, 1.5, 5.45, 5.35);
  text(s, "Clics Meta par mois · 2025 vs 2026", { x: 7.55, y: 1.62, w: 5, h: 0.35, fontSize: 12, bold: true, color: BR });
  const m = ["mars","avr.","mai","juin","juil.","août","sept.","oct.","nov."];
  s.addChart(pres.charts.BAR, [
    { name: "2025", labels: m, values: [0, 0, 1173, 4988, 10546, 10757, 8487, 10021, 2049] },
    { name: "2026", labels: m, values: [984, 2882, 12050, 15112, 14258, 18186, 0, 0, 0] },
  ], Object.assign({}, chartBase, { x: 7.45, y: 2.0, w: 5.2, h: 4.2, barDir: "col", barGapWidthPct: 60, showLegend: true, showValue: false, valAxisMinVal: 0, chartColors: [BR, OR] }));
  text(s, "Août 2026 : 18 186 clics à 0,03 € — le meilleur mois depuis le début de la campagne.", { x: 7.55, y: 6.25, w: 5, h: 0.5, fontSize: 10, color: INK, italic: true });
  footer(s, "Sources : API Meta Ads, compte ANMF (relevé du 04/09/2026) ; reportings Looker campagne 2025 et juin 2026 pour TikTok Ads.");
  s.addNotes("Meta 2025 : 3 275,42 € pour 1 023 895 impressions, 48 021 clics, 41 384 vues à 100 %. Meta 2026 mars-août : 2 542,39 € pour 1 116 233 impressions, 63 472 clics, 58 751 vues à 100 %. TikTok : cumul 2026 non disponible dans les données récupérées (Supermetrics expiré) — seul juin 2026 est documenté : 483 € pour 1,85 M d'impressions, 1,76 M de vues, 7 536 visites.");
}

// ---------------------------------------------------------------- 5. SITE WEB
{
  const s = pres.addSlide();
  s.background = { color: CR };
  kicker(s, "LE SITE WEB");
  title(s, "Le site : le trafic double, pas l'attention", { w: 11 });
  card(s, 0.6, 1.5, 7.2, 3.6);
  text(s, "Sessions mensuelles · 2025 vs 2026", { x: 0.85, y: 1.62, w: 6, h: 0.35, fontSize: 12, bold: true, color: BR });
  const mm = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  s.addChart(pres.charts.LINE, [
    { name: "2025", labels: mm, values: [1317,1425,1443,1451,1875,4174,9991,12075,11687,12143,4189,1309] },
    { name: "2026", labels: mm, values: [2153,1562,2036,2336,5496,12202,18005,22425] },
  ], Object.assign({}, chartBase, { x: 0.7, y: 1.95, w: 7.0, h: 3.1, lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5, showLegend: true, valAxisMinVal: 0, chartColors: [BR, OR] }));
  // donut sources 2026
  card(s, 8.05, 1.5, 4.7, 3.6);
  text(s, "D'où vient le trafic 2026 (jan.-août)", { x: 8.3, y: 1.62, w: 4.3, h: 0.35, fontSize: 12, bold: true, color: BR });
  s.addChart(pres.charts.DOUGHNUT, [{ name: "Sessions", labels: ["Paid social 78 %", "Direct 16 %", "SEO 4 %", "Social organique 1 %", "Autres 1 %"], values: [51792, 10629, 2527, 846, 425] }],
    Object.assign({}, chartBase, { x: 8.15, y: 1.95, w: 4.5, h: 3.1, holeSize: 55, showLegend: true, legendPos: "r", showValue: false, showPercent: false, showLabel: false, chartColors: [OR, BR, YE, GREEN, "C9B7A6"], dataBorder: { pt: 1, color: WH } }));
  // verdict cards
  const v = [
    ["8 %", "de sessions engagées (paid social)", "contre 66 % depuis Google. Le clic est acheté 0,04 €, puis perdu."],
    ["30 s", "de visite moyenne en campagne", "97 s hors campagne. La home : 61 000 sessions, 18 % d'engagement."],
    ["3,8 %", "de trafic SEO seulement", "Fiches métiers et guides : 400 vues chacun en 8 mois. Le site n'existe pas sur Google."],
    ["0", "objectif de conversion configuré", "9 formulaires et 280 téléchargements en 8 mois, jamais comptés : rien ne prouve une candidature."],
  ];
  v.forEach((k, i) => {
    const x = 0.6 + i * 3.09;
    stat(s, x, 5.25, 2.95, 1.68, k[0], k[1], k[2], { bigSize: 22, bigH: 0.4 });
  });
  footer(s, "Source : GA4, propriété chasseursdegraines.fr, 1er janv. 2025 → 31 août 2026. Sessions engagées = > 10 s, ou 2 pages, ou une conversion.");
  s.addNotes("2025 : 63 079 sessions, 20,9 % engagées. 2026 jan.-août : 66 215 sessions, 18,4 % engagées. Août 2026 : 22 425 sessions (+86 % vs août 2025). Canaux 2026 : paid social 51 792, direct 10 629, organic search 2 527, organic social 846. Pages fantômes du thème encore servies : /produit/woo-album-4, /elements/tabs, etc.");
}

// ---------------------------------------------------------------- 6. ON ARRÊTE
{
  const s = pres.addSlide();
  s.background = { color: BR };
  pill(s, "RECOMMANDATIONS · 1/4", 0.6, 0.2, 2.5, 0.3, OR, WH, 9.5);
  text(s, "On arrête", { x: 0.6, y: 0.45, w: 8, h: 0.9, fontFace: HF, fontSize: 40, bold: true, color: WH, valign: "middle" });
  text(s, "Cinq choses qui coûtent du temps ou du budget sans preuve de résultat.", { x: 0.6, y: 1.3, w: 9, h: 0.4, fontSize: 13, color: "F3E3D3" });
  const items = [
    ["X (Twitter)", "1 429 abonnés en mars 2023, 1 423 en mai 2026. Zéro publication en 2026 : on ferme proprement le compte (post de redirection, bio) au lieu de le laisser mourir."],
    ["Envoyer les ads sur la page d'accueil", "78 % du trafic 2026 vient du paid social et seulement 8 % de ces sessions sont engagées. Un clic à 0,04 € qui atterrit sur une home généraliste est un clic jeté."],
    ["Le boost uniforme à 50 / 70 € par publication", "Les POV font 10,6 % de CTR, les reels inspirationnels 3,5 %. On arrête d'arroser tout le planning : le budget va aux 3 formats qui convertissent."],
    ["Les posts « débat » sans animation", "Baromètre, Donne ta définition, Unpopular opinion : 12 à 83 commentaires par mois pour 250 000 à 1 M d'impressions. Ils ne restent que s'ils sont animés (réponses, relance en story)."],
    ["Les livrables sans calendrier ferme", "La ligne UGC prévue chaque mois depuis avril n'a été publiée qu'en septembre. Toute ligne budgétaire 2027 est datée, sinon elle est réallouée en tournage."],
  ];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2, y = 1.85 + row * 1.62, w = 5.95, h = 1.47;
    if (i === 4) { /* last one full width */ }
    const ww = i === 4 ? 12.15 : w;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: ww, h, fill: { color: "A6391F" }, line: { color: "B5482C" }, rectRadius: 0.18 });
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: y + 0.24, w: 0.5, h: 0.5, fill: { color: OR }, line: { color: OR } });
    s.addText("✕", { x: x + 0.22, y: y + 0.24, w: 0.5, h: 0.5, isTextBox: true, fontFace: BF, fontSize: 15, bold: true, color: WH, align: "center", valign: "middle", margin: 0 });
    text(s, it[0], { x: x + 0.9, y: y + 0.16, w: ww - 1.1, h: 0.36, fontFace: HF, fontSize: 15, bold: true, color: YE, valign: "middle" });
    text(s, it[1], { x: x + 0.9, y: y + 0.55, w: ww - 1.1, h: h - 0.62, fontSize: 10.5, color: WH, lineSpacingMultiple: 1.08 });
  });
  footer(s, "Chiffres : relevés d'abonnés, GA4 2026, API Meta Ads (juin 2026 : POV 10,59 % de CTR vs 3,46 % reel Inside 2025), board Monday PE 2026.", true);
}

// ---------------------------------------------------------------- 7. ON CONTINUE / ON AMÉLIORE
{
  const s = pres.addSlide();
  s.background = { color: SAND };
  kicker(s, "RECOMMANDATIONS · 2/4");
  title(s, "On continue, et on améliore", { w: 9 });
  text(s, "Ce qui marche est prouvé par les chiffres. On le garde, et on le pousse un cran plus loin.", { x: 0.6, y: 1.25, w: 9, h: 0.4, fontSize: 13, color: MUTE });
  // left column: continue
  card(s, 0.6, 1.8, 5.95, 5.05);
  pill(s, "ON CONTINUE", 0.85, 2.0, 1.7, 0.32, GREEN, WH, 10);
  const cont = [
    ["TikTok Ads", "CPM 0,26-0,30 €, 10,7 M d'impressions en 2025, 1,85 M rien qu'en juin 2026. Le levier le moins cher pour toucher les 13-24 ans (42 % de l'audience)."],
    ["Inside · POV · Micro-trottoir · FAQ expert", "Les meilleurs hook rates (36 % sur le POV « tes potes en stage ») et la totalité des visites site issues des ads."],
    ["La cadence 16-18 publications / mois", "Tenue sans trou depuis mars 2026 : c'est ce qui a relancé Instagram (+938 abonnés en 5 mois)."],
    ["LinkedIn ANMF", "Taux d'engagement 10 % en 2025, 25 % en juin 2026, +27 % d'abonnés. Le seul canal qui parle aux prescripteurs."],
    ["Les stories interactives", "Grain de vérité, T'es plutôt, La bonne graine, Le compte est bon : 3 sets par mois, mécaniques natives, zéro média."],
  ];
  cont.forEach((it, i) => {
    const y = 2.45 + i * 0.86;
    text(s, it[0], { x: 0.9, y, w: 5.4, h: 0.3, fontSize: 11.5, bold: true, color: BR });
    text(s, it[1], { x: 0.9, y: y + 0.29, w: 5.4, h: 0.55, fontSize: 9.5, color: INK, lineSpacingMultiple: 1.05 });
  });
  // right column: améliorer
  card(s, 6.8, 1.8, 5.95, 5.05);
  pill(s, "ON AMÉLIORE", 7.05, 2.0, 1.7, 0.32, OR, WH, 10);
  const imp = [
    ["Le ciblage Meta", "45-54 ans = 22 % de l'audience 2025, 65+ en tête des impressions en juin 2026. Cible 16-30 : audiences, placements Reels et créas jeunes en priorité."],
    ["L'optimisation des campagnes", "Aujourd'hui sur le clic. Demain sur la session engagée puis le lead, via événements GA4 et pixels Meta / TikTok."],
    ["Le retargeting", "60 000 visiteurs en 2026 jamais recontactés. Une audience site + engagés vidéo à relancer avec les témoignages."],
    ["La mesure des stories", "3 sets par mois, aucun KPI dans le reporting. Réponses aux stickers et clics lien à intégrer au dashboard."],
    ["L'UGC", "Passer d'une créatrice à un programme d'apprentis-ambassadeurs : 4 profils, 1 vidéo par mois chacun, brief et cadre contractuel."],
  ];
  imp.forEach((it, i) => {
    const y = 2.45 + i * 0.86;
    text(s, it[0], { x: 7.1, y, w: 5.4, h: 0.3, fontSize: 11.5, bold: true, color: BR });
    text(s, it[1], { x: 7.1, y: y + 0.29, w: 5.4, h: 0.55, fontSize: 9.5, color: INK, lineSpacingMultiple: 1.05 });
  });
  footer(s, "Chiffres : reportings Looker 2025 et juin 2026, API Meta Ads, GA4, board Monday PE 2026.");
}


// ---------------------------------------------------------------- 8. ON AJOUTE · SOCIAL & MARKETING
{
  const s = pres.addSlide();
  s.background = { color: CR };
  kicker(s, "RECOMMANDATIONS · 3/4");
  title(s, "On ajoute (1) : six leviers pour changer d'échelle", { w: 11 });
  text(s, "Le dispositif 2026 a prouvé le contenu et la médiatisation. 2027 va chercher la cible là où elle décide, et transforme l'audience en candidats.", { x: 0.6, y: 1.25, w: 11.5, h: 0.4, fontSize: 12.5, color: MUTE });
  const items = [
    ["Opération Parcoursup", "Lycéens · conversion", "Du 15 janvier au 13 mars, la seule fenêtre où les lycéens choisissent. Série quotidienne « 48 h avant tes vœux », live TikTok apprenti + chef meunier, dark concentré sur 8 semaines vers la page lycéen."],
    ["4 apprentis-ambassadeurs", "Étudiants · preuve sociale", "Quatre apprentis dans quatre moulins filment leur mois en vlog de 60 s. Plus crédible qu'une créatrice extérieure, un vivier de témoignages pour le site et les ads, et un calendrier qu'on tient."],
    ["Influence orientation, pas lifestyle", "16-20 ans · reach", "Deux créateurs qui parlent études, alternance et Parcoursup aux 16-20 ans. Ils portent la cible qu'on va chercher aujourd'hui uniquement en payant, avec un discours qu'ils ont déjà installé."],
    ["Snapchat + YouTube Shorts", "13-24 ans · distribution", "Les 20 vidéos existent déjà. Snapchat est un des premiers réseaux des 15-24 ans en France, Shorts le second écran des 13-17. Zéro production supplémentaire, deux canaux de plus."],
    ["Les DM Instagram automatisés", "Communauté · leads", "Un mot-clé en commentaire (« GUIDE ») envoie le guide des formations en message privé et capte l'e-mail. Les commentaires deviennent des leads, et chaque post fixe retrouve une raison d'exister."],
    ["Le terrain filmé", "Prescripteurs · notoriété", "Tournée micro-trottoir de 4 CFA et lycées pro, Journées européennes des moulins en mai avec une visite à gagner, salons d'orientation couverts en stories. Le contenu vient du réel, et les prescripteurs rencontrent la campagne."],
  ];
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.6 + col * 4.1, y = 1.85 + row * 2.5, w = 3.95, h = 2.35;
    card(s, x, y, w, h);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.44, h: 0.44, fill: { color: OR }, line: { color: OR } });
    s.addText(String(i + 1), { x: x + 0.25, y: y + 0.25, w: 0.44, h: 0.44, isTextBox: true, fontFace: HF, fontSize: 13, bold: true, color: WH, align: "center", valign: "middle", margin: 0 });
    text(s, it[0], { x: x + 0.82, y: y + 0.22, w: w - 1.0, h: 0.5, fontFace: HF, fontSize: 14, bold: true, color: BR, valign: "middle", lineSpacingMultiple: 0.95 });
    pill(s, it[1].toUpperCase(), x + 0.25, y + 0.85, 2.3, 0.26, CR, BR, 7.5);
    text(s, it[2], { x: x + 0.25, y: y + 1.2, w: w - 0.5, h: h - 1.3, fontSize: 9.6, color: INK, lineSpacingMultiple: 1.06 });
  });
  footer(s, "Cibles issues de la stratégie 2026 (lycéens, étudiants et jeunes actifs, reconversion, prescripteurs). Persona TikTok 2025 : 42 % de 18-24 ans, 21 % de 13-17 ans.");
  s.addNotes("Chaque levier répond à un trou vu dans la donnée : la saisonnalité du site (×10 en campagne, rien hors campagne) pour Parcoursup ; la ligne UGC non tenue pour les ambassadeurs ; le ciblage Meta vieillissant pour l'influence orientation et Snapchat ; les commentaires quasi nuls des posts fixes pour les DM automatisés ; la 4e cible sans contenu pour le terrain.");
}

// ---------------------------------------------------------------- 9. ON AJOUTE · SITE
{
  const s = pres.addSlide();
  s.background = { color: CR };
  kicker(s, "RECOMMANDATIONS · 4/4");
  title(s, "On ajoute (2) : le site convertit", { w: 7 });
  text(s, "Le social sait créer l'attention. En 2027, chasseursdegraines.fr doit la transformer et la prouver.", { x: 0.6, y: 1.3, w: 7.0, h: 0.4, fontSize: 12.5, color: MUTE });
  const web = [
    ["3 pages d'atterrissage par cible", "Lycéen · reconversion · prescripteur, chacune branchée sur ses ads. Objectif : passer de 8 % à 30 % de sessions engagées depuis le paid."],
    ["Un tunnel mesurable", "« Visiter un moulin », « être rappelé », « candidater en alternance » : formulaires courts, événements GA4, pixels Meta et TikTok. Premier chiffre de leads dès le T1."],
    ["Le SEO de fond", "Fiches métiers et guides de formation réécrits pour la recherche (66 % d'engagement sur ce trafic aujourd'hui), pages fantômes du thème supprimées, Search Console suivie."],
    ["La carte des moulins et les offres en vitrine", "Jamais poussées en social : elles deviennent la destination des POV et des témoignages."],
  ];
  web.forEach((it, i) => {
    const y = 1.9 + i * 0.98;
    s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.03, w: 0.42, h: 0.42, fill: { color: OR }, line: { color: OR } });
    s.addText(String(i + 1), { x: 0.6, y: y + 0.03, w: 0.42, h: 0.42, isTextBox: true, fontFace: HF, fontSize: 13, bold: true, color: WH, align: "center", valign: "middle", margin: 0 });
    text(s, it[0], { x: 1.15, y, w: 6.2, h: 0.3, fontSize: 12, bold: true, color: BR });
    text(s, it[1], { x: 1.15, y: y + 0.3, w: 6.2, h: 0.68, fontSize: 9.8, color: INK, lineSpacingMultiple: 1.05 });
  });
  // social additions strip
  // ce que ça change
  const gains = [["8 % → 30 %", "de sessions engagées\ndepuis le paid social"], ["3,8 % → 15 %", "de trafic SEO\nsur les fiches métiers"], ["0 → 500", "leads mesurés\npar an"]];
  gains.forEach((g, i) => {
    const x = 0.6 + i * 2.3;
    card(s, x, 5.85, 2.15, 1.05);
    text(s, g[0], { x: x + 0.2, y: 5.92, w: 1.9, h: 0.45, fontFace: HF, fontSize: 18, bold: true, color: OR, valign: "middle" });
    text(s, g[1], { x: x + 0.2, y: 6.36, w: 1.9, h: 0.5, fontSize: 8.8, color: MUTE, lineSpacingMultiple: 1.05 });
  });
  // laptop mockup with landing page wireframe
  laptop(s, 7.85, 2.1, 4.95, (x, y, w, h) => {
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: CR }, line: { color: CR } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.32, fill: { color: WH }, line: { color: WH } });
    s.addImage({ path: img("ChasseursDeGraines_Logo_Quadri.png"), x: x + 0.1, y: y + 0.02, w: 0.6, h: 0.29 });
    text(s, "Métiers   Formations   Moulins   Offres", { x: x + 1.2, y: y + 0.05, w: 3.2, h: 0.24, fontSize: 7.5, color: MUTE, valign: "middle" });
    pill(s, "Je visite un moulin", x + w - 1.25, y + 0.05, 1.15, 0.22, OR, WH, 6.5);
    text(s, "25 000 postes. Et si c'était toi ?", { x: x + 0.25, y: y + 0.45, w: w - 0.5, h: 0.6, fontFace: HF, fontSize: 17, bold: true, color: BR, lineSpacingMultiple: 1.0 });
    text(s, "Choisis ton profil, on te montre le chemin.", { x: x + 0.25, y: y + 1.05, w: w - 0.5, h: 0.25, fontSize: 8, color: INK });
    const cta = [["Lycéen·ne", OR], ["En reconversion", BR], ["Prof / CIO", YE]];
    cta.forEach((c, i) => {
      const cw = (w - 0.5 - 0.2) / 3;
      const cx = x + 0.25 + i * (cw + 0.1);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: y + 1.4, w: cw, h: 0.7, fill: { color: WH }, line: { color: "EADCC8" }, rectRadius: 0.1 });
      s.addShape(pres.shapes.OVAL, { x: cx + 0.12, y: y + 1.52, w: 0.22, h: 0.22, fill: { color: c[1] }, line: { color: c[1] } });
      text(s, c[0], { x: cx + 0.4, y: y + 1.5, w: cw - 0.45, h: 0.26, fontSize: 8, bold: true, color: BR, valign: "middle" });
      text(s, "→ ma page", { x: cx + 0.4, y: y + 1.78, w: cw - 0.45, h: 0.22, fontSize: 7, color: MUTE, valign: "middle" });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.25, y: y + 2.25, w: w - 0.5, h: 0.45, fill: { color: WH }, line: { color: "EADCC8" }, rectRadius: 0.08 });
    text(s, "Ton e-mail pour recevoir le guide Parcoursup × meunerie", { x: x + 0.38, y: y + 2.25, w: w - 2.0, h: 0.45, fontSize: 7.5, color: MUTE, valign: "middle" });
    pill(s, "Je reçois le guide", x + w - 1.55, y + 2.33, 1.2, 0.29, BR, WH, 7);
  });
  text(s, "Principe de page d'atterrissage « lycéen » — maquette de travail, à concevoir.", { x: 7.9, y: 5.6, w: 4.9, h: 0.3, fontSize: 8.5, color: MUTE, italic: true, align: "center" });
  footer(s, "Chiffres : GA4 2026 (sessions engagées paid social 8 %, organic search 66 %). Les pages /produit/… et /elements/tabs du thème sont encore servies et comptées.");
}

// ---------------------------------------------------------------- 9. CAP 2027
{
  const s = pres.addSlide();
  s.background = { color: SAND };
  kicker(s, "CAP 2027");
  title(s, "Ce qu'on vise, et comment on y va", { w: 9 });
  // KPI table
  card(s, 0.6, 1.5, 7.0, 3.55);
  text(s, "Objectifs proposés pour 2027", { x: 0.85, y: 1.62, w: 6, h: 0.35, fontSize: 12, bold: true, color: BR });
  const rows = [
    ["Indicateur", "Aujourd'hui", "Objectif 2027"],
    ["Abonnés Instagram", "3 496 (juil. 2026)", "5 000"],
    ["Abonnés TikTok", "813 (juil. 2026)", "1 500"],
    ["Abonnés LinkedIn ANMF", "6 632 (juil. 2026)", "7 500"],
    ["Sessions site / an", "66 215 (8 mois 2026)", "120 000"],
    ["Sessions engagées depuis le paid", "8 %", "30 %"],
    ["Leads mesurés (visite, rappel, candidature)", "non mesuré", "500"],
    ["CPC Meta · CPM TikTok", "0,04 € · 0,26 €", "≤ 0,05 € · ≤ 0,30 €"],
  ];
  const tRows = rows.map((r, ri) => r.map((c, ci) => ({ text: c, options: { fontFace: BF, fontSize: 10, bold: ri === 0 || ci === 2, color: ri === 0 ? MUTE : (ci === 2 ? OR : INK), align: ci === 0 ? "left" : "right", fill: { color: WH }, border: { type: "solid", pt: 0.5, color: "EFE4D3" }, margin: [2, 6, 2, 6] } })));
  s.addTable(tRows, { x: 0.85, y: 2.0, w: 6.5, colW: [3.0, 1.9, 1.6], rowH: 0.34 });
  // dispositif
  card(s, 7.85, 1.5, 4.9, 3.55, BR);
  text(s, "Le dispositif 2027", { x: 8.1, y: 1.62, w: 4.4, h: 0.35, fontSize: 12, bold: true, color: YE });
  bullets(s, [
    "12 mois sans trou d'inter-campagne : les abonnés stagnent dès que ça s'arrête",
    "18 publications / mois + 3 sets de stories, diffusés aussi sur Snapchat et Shorts",
    "Opération Parcoursup (janv.-mars) et rentrée : dark concentré, optimisé sur le lead",
    "4 apprentis-ambassadeurs, 2 créateurs orientation, tournée de 4 CFA",
    "DM automatisés, retargeting, pages d'atterrissage, tunnel et SEO",
    "Un dashboard social + site + leads, lu ensemble chaque mois",
  ], 8.1, 2.05, 4.4, 2.95, { size: 10.5, color: WH, gap: 5 });
  // timeline
  const steps = [["Octobre 2026", "Présentation du bilan et des recommandations"], ["Novembre", "Proposition 2027 chiffrée : social + site"], ["Décembre", "Signature, brief créa et plan de tournage"], ["Janvier 2027", "Pages d'atterrissage en ligne avant les vœux Parcoursup"]];
  steps.forEach((st, i) => {
    const x = 0.6 + i * 3.09;
    card(s, x, 5.3, 2.95, 1.55);
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: 5.5, w: 0.36, h: 0.36, fill: { color: i === 3 ? OR : YE }, line: { color: i === 3 ? OR : YE } });
    s.addText(String(i + 1), { x: x + 0.22, y: 5.5, w: 0.36, h: 0.36, isTextBox: true, fontFace: HF, fontSize: 11, bold: true, color: i === 3 ? WH : BR, align: "center", valign: "middle", margin: 0 });
    text(s, st[0], { x: x + 0.7, y: 5.5, w: 2.1, h: 0.36, fontSize: 11.5, bold: true, color: BR, valign: "middle" });
    text(s, st[1], { x: x + 0.22, y: 5.95, w: 2.55, h: 0.8, fontSize: 9.8, color: INK, lineSpacingMultiple: 1.05 });
  });
  footer(s, "Objectifs proposés à partir des tendances 2025-2026 ; à valider avec l'ANMF. « Leads mesurés » suppose le tunnel et les événements GA4 décrits en page précédente.");
}

pres.writeFile({ fileName: path.join(__dirname, "CDG_Bilan_2025-2026_Cap_2027.pptx") }).then(f => console.log("ok", f));
