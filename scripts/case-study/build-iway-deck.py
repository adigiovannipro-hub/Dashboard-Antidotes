# -*- coding: utf-8 -*-
"""Case study I-WAY — 3 slides, DA Antidotes (mint, cartes blanches, Montserrat + Inter).

Le script est autonome : il ne dépend que de python-pptx et Pillow, et d'un dossier
d'actifs (ASSETS). Il est écrit pour tourner à l'identique en local et dans le
workbench Composio (où les actifs sont rapatriés depuis Drive).
"""
import os, sys, io, copy
from PIL import Image, ImageDraw
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_TICK_LABEL_POSITION
from pptx.oxml.ns import qn
from lxml import etree

ASSET_DIR = os.environ.get("ASSET_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets"))
OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "I-WAY_Case_Study_Antidotes.pptx"))
WORK = os.path.join(ASSET_DIR, "_derived")
os.makedirs(WORK, exist_ok=True)

# Identifiants Drive des actifs (dossier I-WAY), pour les rapatrier depuis le workbench Composio :
#   DSC00850.jpg 1lP4-CWEXUmOmsi5o30QmYGdNY-LU5Ntc · DSC00359.jpg 1gZm-ZP00XiwtTdFBSMRLOn-zqD8ulV_A
#   ALL STARS 1.png 1CXC7m4OJrvQWvmMfbps48-vjW8r58lkn · GUESS THE PODIUM 1.png 1dGbSwFhccxub_QGK83cn6kVTnJm4mzgC
#   GRID TALK 1.png 1-6cHnsEnDqj6I8F8tK11-LUlZr8jWBTI · CARROUSEL 1.png 1Wbkqb-i5lBO9FNjPBQOslJh_U_rl6uaF
#   I-WAY AGENDA.png 1rE0ViRK5aPyNDVWrP6DnkJytXQlUKJVT · ANTIDOTES_TEMPLATE_2025_LINKEDIN_MOCKUP_1_REELS_I-WAY.png 1LgHvB74RUmUn9wR1y0bP7LEfXBWJnvgq
#   rep-2.png = page 2 de [I-WAY]_Reporting_mensuel_juillet.pdf 1IUDFgqyvZ817cbyNYa_-SrthnEifHHeH (rendu à 110 dpi)
ASSETS = {
    "photo_f1": "DSC00850.jpg",
    "photo_avion": "DSC00359.jpg",
    "story_allstars": "ALL_STARS_1.png",
    "story_podium": "GUESS_THE_PODIUM_1.png",
    "story_gridtalk": "GRID_TALK_1.png",
    "post_carrousel": "CARROUSEL_1.png",
    "post_agenda": "agenda.png",
    "mockup_reels": "mockup_reels_iway.png",
    "dashboard": "rep-2.png",
}
def A(k):
    p = os.path.join(ASSET_DIR, ASSETS[k])
    if not os.path.exists(p):
        raise SystemExit(f"actif manquant : {p}")
    return p

# ── DA Antidotes (tokens.css) ─────────────────────────────────────────────
INK = RGBColor(0x1A, 0x1A, 0x1A)
INK2 = RGBColor(0x6B, 0x6B, 0x66)
ACCENT = RGBColor(0x70, 0xAD, 0x47)
ACCENT_INK = RGBColor(0x2F, 0x53, 0x20)
MINT = RGBColor(0xD9, 0xFA, 0xCF)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LINE = RGBColor(0xEA, 0xEA, 0xE7)
LINE_STRONG = RGBColor(0xDC, 0xDC, 0xD8)
CANVAS = RGBColor(0xF5, 0xF5, 0xF3)
FRAME = RGBColor(0x14, 0x14, 0x14)
H_FONT = "Montserrat"
B_FONT = "Inter"

SW, SH = 13.333, 7.5

# ── images dérivées ────────────────────────────────────────────────────────
def rounded(img, radius):
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    img.putalpha(mask)
    return img

def cover(img, ratio, focus=0.5):
    """Recadre au ratio (w/h) demandé, en gardant le centre (focus vertical 0..1)."""
    w, h = img.size
    if w / h > ratio:
        nw = int(h * ratio); x0 = (w - nw) // 2
        return img.crop((x0, 0, x0 + nw, h))
    nh = int(w / ratio); y0 = int((h - nh) * focus)
    return img.crop((0, y0, w, y0 + nh))

def derive(name, src, ratio=None, width=900, radius=None, focus=0.5, fmt="JPEG", quality=82):
    out = os.path.join(WORK, name + (".png" if fmt == "PNG" else ".jpg"))
    img = Image.open(src)
    img = img.convert("RGB")
    if ratio:
        img = cover(img, ratio, focus)
    if img.size[0] > width:
        img = img.resize((width, int(img.size[1] * width / img.size[0])), Image.LANCZOS)
    out = os.path.join(WORK, name + ".jpg")
    img.save(out, "JPEG", quality=quality, optimize=True)
    return out

# ── primitives ─────────────────────────────────────────────────────────────
def shadow(shape, blur=9, dist=2, alpha=7):
    spPr = shape._element.spPr
    for e in spPr.findall(qn("a:effectLst")):
        spPr.remove(e)
    eff = etree.SubElement(spPr, qn("a:effectLst"))
    sh = etree.SubElement(eff, qn("a:outerShdw"), blurRad=str(int(blur * 12700)), dist=str(int(dist * 12700)),
                          dir="5400000", algn="t", rotWithShape="0")
    clr = etree.SubElement(sh, qn("a:srgbClr"), val="000000")
    etree.SubElement(clr, qn("a:alpha"), val=str(alpha * 1000))

def no_shadow(shape):
    spPr = shape._element.spPr
    if spPr.find(qn("a:effectLst")) is None:
        etree.SubElement(spPr, qn("a:effectLst"))

def rect(slide, x, y, w, h, fill=WHITE, line=None, radius=None, shadow_on=False, line_w=0.75):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius:
        s.adjustments[0] = min(0.5, radius / min(w, h))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line; s.line.width = Pt(line_w)
    if shadow_on:
        shadow(s)
    else:
        no_shadow(s)
    s.text_frame.text = ""
    return s

def text(slide, x, y, w, h, paras, font=B_FONT, size=11, color=INK, bold=False, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, margin=0, line_spacing=None, space_after=None, italic=False):
    """paras : str | list de paragraphes ; un paragraphe = str | dict(runs=[...], size, color, bold, font, space_after, bullet)
    un run = str | dict(t, bold, color, size, font, link, italic)"""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = anchor
    if isinstance(paras, str):
        paras = [paras]
    first = True
    for p in paras:
        if isinstance(p, str):
            p = {"runs": [p]}
        para = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        para.alignment = p.get("align", align)
        if line_spacing or p.get("line_spacing"):
            para.line_spacing = p.get("line_spacing", line_spacing)
        sa = p.get("space_after", space_after)
        if sa is not None:
            para.space_after = Pt(sa)
        if p.get("space_before") is not None:
            para.space_before = Pt(p["space_before"])
        if p.get("bullet"):
            pPr = para._p.get_or_add_pPr()
            pPr.set("marL", str(int(Inches(0.16)))); pPr.set("indent", str(-int(Inches(0.16))))
            bu = etree.SubElement(pPr, qn("a:buClr")); c = etree.SubElement(bu, qn("a:srgbClr")); c.set("val", "70AD47")
            etree.SubElement(pPr, qn("a:buFont"), typeface="Arial")
            etree.SubElement(pPr, qn("a:buChar"), char="•")
        for r in p.get("runs", []):
            if isinstance(r, str):
                r = {"t": r}
            run = para.add_run()
            run.text = r["t"]
            f = run.font
            f.name = r.get("font", p.get("font", font))
            f.size = Pt(r.get("size", p.get("size", size)))
            f.bold = r.get("bold", p.get("bold", bold))
            f.italic = r.get("italic", p.get("italic", italic))
            f.color.rgb = r.get("color", p.get("color", color))
            if r.get("link"):
                run.hyperlink.address = r["link"]
    return tb

def pill(slide, x, y, w, h, label, size=9, fill=None, line=INK, color=INK, bold=False, font=B_FONT, link=None):
    s = rect(slide, x, y, w, h, fill=fill if fill is not None else None, line=line, radius=h / 2, line_w=0.75)
    if fill is None:
        s.fill.background()
    tf = s.text_frame
    tf.margin_left = tf.margin_right = Inches(0.06); tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = label
    r.font.name = font; r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color
    if link:
        s.click_action.hyperlink.address = link
    return s

def pic_rect(slide, path, x, y, w, h, radius=0.12, shadow_on=False):
    """Image dans un rectangle arrondi : remplissage blipFill, donc JPEG sans couche alpha."""
    s = rect(slide, x, y, w, h, fill=WHITE, line=None, radius=radius, shadow_on=shadow_on)
    image_part, rId = slide.part.get_or_add_image_part(path)
    spPr = s._element.spPr
    solid = spPr.find(qn("a:solidFill"))
    blip = etree.Element(qn("a:blipFill"))
    b = etree.SubElement(blip, qn("a:blip")); b.set(qn("r:embed"), rId)
    st = etree.SubElement(blip, qn("a:stretch")); etree.SubElement(st, qn("a:fillRect"))
    solid.addprevious(blip); spPr.remove(solid)
    return s

def picture(slide, path, x, y, w=None, h=None, shadow_on=False):
    pic = slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w) if w else None, Inches(h) if h else None)
    if shadow_on:
        shadow(pic)
    return pic

def phone(slide, x, y, w, screen_png, caption=None, cap_w=None):
    """Mockup iPhone : cadre noir arrondi, écran arrondi, île dynamique."""
    h = w * 2.13
    frame = rect(slide, x, y, w, h, fill=FRAME, line=None, radius=w * 0.19, shadow_on=True)
    inset = w * 0.045
    pic_rect(slide, screen_png, x + inset, y + inset, w - 2 * inset, h - 2 * inset, radius=w * 0.15)
    rect(slide, x + w / 2 - w * 0.16, y + inset + w * 0.055, w * 0.32, w * 0.075, fill=FRAME, radius=w * 0.0375)
    if caption:
        text(slide, x - 0.15, y + h + 0.1, (cap_w or w) + 0.3, 0.4, caption, size=9, color=INK2, align=PP_ALIGN.CENTER)
    return h

def macbook(slide, x, y, w, screen_jpg):
    """Mockup MacBook : écran + charnière + base."""
    bezel = w * 0.018
    img_ratio = 1565 / 880
    sw = w - 2 * bezel
    sh = sw / img_ratio
    rect(slide, x, y, w, sh + 2 * bezel + 0.02, fill=RGBColor(0x1F, 0x1F, 0x1F), radius=0.12, shadow_on=True)
    pic_rect(slide, screen_jpg, x + bezel, y + bezel, sw, sh, radius=0.05)
    base_h = 0.13
    base = rect(slide, x - w * 0.06, y + sh + 2 * bezel + 0.02, w * 1.12, base_h, fill=RGBColor(0xD6, 0xD6, 0xD3), radius=0.05)
    rect(slide, x + w * 0.5 - w * 0.09, y + sh + 2 * bezel + 0.02, w * 0.18, 0.04, fill=RGBColor(0xB8, 0xB8, 0xB4))
    return sh + 2 * bezel + 0.02 + base_h

def background(slide):
    fill = slide.background.fill
    fill.gradient(); fill.gradient_angle = 35
    st = fill.gradient_stops
    st[0].position = 0.0; st[0].color.rgb = MINT
    st[1].position = 1.0; st[1].color.rgb = RGBColor(0xFB, 0xFB, 0xF9)

def signature(slide, x=0.6, y=0.38, align=PP_ALIGN.LEFT):
    text(slide, x, y, 3.6, 0.42, [
        {"runs": [{"t": "Alessandro ", "bold": False}, {"t": "Di Giovanni", "bold": True}], "size": 11},
        {"runs": ["Expert Social Media & Influence"], "size": 9.5, "color": INK2},
    ], line_spacing=1.0, align=align)

def wordmark(slide, x=11.95, y=7.02):
    d = slide.shapes.add_shape(MSO_SHAPE.DIAMOND, Inches(x), Inches(y + 0.07), Inches(0.13), Inches(0.13))
    d.fill.solid(); d.fill.fore_color.rgb = INK; d.line.fill.background(); no_shadow(d)
    text(slide, x + 0.19, y, 1.2, 0.3, "Antidotes", font=B_FONT, size=10.5, bold=True, color=INK, anchor=MSO_ANCHOR.MIDDLE)

def overline(slide, x, y, w, label):
    text(slide, x, y, w, 0.25, label, size=9, bold=True, color=ACCENT_INK)

def numbered(slide, x, y, n, title, desc, w):
    c = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y + 0.02), Inches(0.34), Inches(0.34))
    c.fill.solid(); c.fill.fore_color.rgb = MINT; c.line.fill.background(); no_shadow(c)
    tf = c.text_frame; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    r = p.add_run(); r.text = str(n); r.font.name = H_FONT; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = ACCENT_INK
    text(slide, x + 0.46, y - 0.01, w - 0.3, 0.3, title, font=H_FONT, size=11, bold=True)
    text(slide, x + 0.46, y + 0.29, w - 0.36, 0.75, desc, size=10.5, color=INK2, line_spacing=1.1)

# ── données ────────────────────────────────────────────────────────────────
MONTHS = ["09/22","10/22","11/22","12/22","01/23","02/23","03/23","04/23","05/23","06/23","07/23","08/23","09/23","10/23","11/23","12/23",
          "01/24","02/24","03/24","04/24","05/24","06/24","07/24","08/24","09/24","10/24","11/24","12/24",
          "01/25","02/25","03/25","04/25","05/25","06/25","07/25","08/25","09/25","10/25","11/25","12/25",
          "01/26","02/26","03/26","04/26","05/26","06/26","07/26"]
IG = [866,1091,1210,1718,1761,2245,2276,2475,2737,2869,2924,2923,2912,4674,5273,5722,
      5804,6470,7637,8323,8973,9673,10298,10610,11248,11394,11740,12169,
      12440,12786,13300,13813,14502,14873,15588,15798,16934,18066,18738,19862,
      20665,20934,21288,21438,21980,21914,21742]
TT = [None]*6 + [593,1908,4381,7033,8203,8838,8823,9834,10217,10398,
      10584,10743,11564,12112,12219,12442,12529,12551,12649,12682,12924,13043,
      13018,13063,12996,12970,13174,13186,13237,13287,13277,13283,13457,13534,
      13556,13575,13576,13570,13645,13717,13772]
assert len(MONTHS) == len(IG) == len(TT) == 47

# ── construction ───────────────────────────────────────────────────────────
def build():
    prs = Presentation()
    prs.slide_width = Inches(SW); prs.slide_height = Inches(SH)
    blank = prs.slide_layouts[6]

    photo_f1 = derive("photo_f1", A("photo_f1"), ratio=3.9 / 3.05, width=1100, focus=0.62, quality=80)
    photo_avion = derive("photo_avion", A("photo_avion"), ratio=4.55 / 1.3, width=1100, focus=0.6, quality=80)
    scr = {k: derive("scr_" + k, A(k), ratio=9 / 19.2, width=560, quality=85)
           for k in ("story_allstars", "story_podium", "story_gridtalk")}
    carrousel = derive("carrousel", A("post_carrousel"), ratio=0.8, width=620, quality=85)
    agenda = derive("agenda", A("post_agenda"), ratio=0.8, width=620, quality=85)
    reels = derive("reels", A("mockup_reels"), ratio=4.9 / 6.0, width=1200, focus=0.5, quality=82)
    dash = derive("dash", A("dashboard"), width=1500, quality=80)

    # ════════ SLIDE 1 — Brief & réponse ════════
    s = prs.slides.add_slide(blank); background(s); signature(s); wordmark(s)
    text(s, 0.6, 1.0, 4.0, 1.0, "I-WAY", font=H_FONT, size=58, bold=True, line_spacing=0.9)
    text(s, 0.6, 1.95, 4.1, 0.5, "Case study social media", font=H_FONT, size=20, bold=True, color=INK)
    pill(s, 0.6, 2.55, 1.35, 0.3, "2022 → 2026", size=9.5, fill=INK, line=INK, color=WHITE, bold=True)
    text(s, 2.05, 2.55, 2.6, 0.3, "Lyon · Paris", size=10, color=INK2, anchor=MSO_ANCHOR.MIDDLE)
    xs = 0.6
    for lab, w in (("Instagram", 0.8), ("TikTok", 0.62), ("LinkedIn", 0.74), ("YouTube", 0.74), ("Facebook", 0.8)):
        pill(s, xs, 3.05, w, 0.3, lab, size=8.5); xs += w + 0.07
    pic_rect(s, photo_f1, 0.6, 3.6, 3.9, 3.05, radius=0.14, shadow_on=True)
    text(s, 0.6, 6.72, 3.9, 0.25, "Shooting simulateur F1 — I-WAY Lyon, 2026", size=8.5, color=INK2)

    # carte brief
    rect(s, 4.85, 0.9, 3.85, 6.05, fill=WHITE, line=LINE, radius=0.16, shadow_on=True)
    overline(s, 5.1, 1.1, 3.4, "LE BRIEF")
    text(s, 5.1, 1.36, 3.4, 0.8, "Un lieu unique au monde, une marque encore éclatée en ligne", font=H_FONT, size=15, bold=True, line_spacing=1.05)
    text(s, 5.1, 2.2, 3.4, 4.6, [
        {"runs": ["I-WAY, c'est 10 activités dans un même lieu à Lyon et Paris : simulateurs F1, MotoGP, rallye et avion de chasse, réalité virtuelle, escape game, quiz room. Deux clientèles : le grand public et les entreprises (séminaires, team building)."], "size": 11, "color": INK, "space_after": 9, "line_spacing": 1.12},
        {"runs": [{"t": "Point de départ, été 2022", "bold": True}], "size": 11, "space_after": 3},
        {"runs": ["Trois identités qui se concurrencent (I-WAY World, I-WAY Simulation, I-WAY Lyon), aucun compte TikTok"], "bullet": True, "size": 10.5, "color": INK2, "space_after": 2, "line_spacing": 1.1},
        {"runs": ["Instagram 866 abonnés · LinkedIn 440 · Facebook 18 219 fans mais zéro budget média"], "bullet": True, "size": 10.5, "color": INK2, "space_after": 9, "line_spacing": 1.1},
        {"runs": [{"t": "Ce que le client attend", "bold": True}], "size": 11, "space_after": 3},
        {"runs": ["Une seule marque, la même sur tous les réseaux"], "bullet": True, "size": 10.5, "color": INK2, "space_after": 2, "line_spacing": 1.1},
        {"runs": ["Recruter une communauté sport auto et la faire réserver"], "bullet": True, "size": 10.5, "color": INK2, "space_after": 2, "line_spacing": 1.1},
        {"runs": ["Développer les séminaires d'entreprise via LinkedIn"], "bullet": True, "size": 10.5, "color": INK2, "space_after": 2, "line_spacing": 1.1},
        {"runs": ["Faire vivre les sensations en vidéo, chaque mois"], "bullet": True, "size": 10.5, "color": INK2, "line_spacing": 1.1},
    ])

    # carte réponse
    rect(s, 8.95, 0.9, 3.8, 6.05, fill=WHITE, line=LINE, radius=0.16, shadow_on=True)
    overline(s, 9.2, 1.1, 3.4, "LA RÉPONSE")
    text(s, 9.2, 1.36, 3.35, 0.8, "Un dispositif social media 360°, piloté de A à Z", font=H_FONT, size=15, bold=True, line_spacing=1.05)
    rows = [
        ("Stratégie & set-up", "Audit des comptes, noms et URL unifiés, création du compte TikTok, ligne éditoriale propre à chaque réseau."),
        ("Direction artistique & production", "Templates renouvelés chaque année, shootings photo, tournages vidéo, formats signature récurrents."),
        ("Planning & community management", "≈ 28 contenus par mois sur 5 réseaux, jeux concours, UGC, modération et réponses aux messages."),
        ("Social ads & reporting", "Sponsorisation Meta et TikTok pilotée au CPM et au coût par réservation, dashboard mensuel."),
    ]
    yy = 2.3
    for i, (t, d) in enumerate(rows, 1):
        numbered(s, 9.2, yy, i, t, d, 3.35); yy += 1.15

    # ════════ SLIDE 2 — Créations ════════
    s = prs.slides.add_slide(blank); background(s); wordmark(s); signature(s, x=9.15, y=0.38, align=PP_ALIGN.RIGHT)
    text(s, 0.6, 0.42, 7.5, 0.6, "La réponse en images", font=H_FONT, size=32, bold=True)
    text(s, 0.6, 1.02, 7.0, 0.35, "Formats signature, shootings photo et vidéos livrés chaque mois sur cinq réseaux", size=11, color=INK2)
    px = 0.6; pw = 1.42; gap = 0.15; py = 1.55
    caps = {"story_allstars": "Story · All Stars × i-Quiz", "story_podium": "Story · Guess the Podium", "story_gridtalk": "Story · Grid Talk"}
    for k in ("story_allstars", "story_podium", "story_gridtalk"):
        ph = phone(s, px, py, pw, scr[k], caption=caps[k]); px += pw + gap
    # colonne de posts 4:5
    cx = px + 0.1; cw = 1.55
    pic_rect(s, carrousel, cx, py, cw, cw * 1.25, radius=0.1, shadow_on=True)
    text(s, cx - 0.1, py + cw * 1.25 + 0.06, cw + 0.2, 0.3, "Post · Carrousel LinkedIn", size=9, color=INK2, align=PP_ALIGN.CENTER)
    y2 = py + cw * 1.25 + 0.42
    pic_rect(s, agenda, cx, y2, cw, cw * 1.25, radius=0.1, shadow_on=True)
    text(s, cx - 0.1, y2 + cw * 1.25 + 0.06, cw + 0.2, 0.3, "Post · Calendrier sport auto", size=9, color=INK2, align=PP_ALIGN.CENTER)
    # bande basse : photo de tournage, puis les formats en pastilles
    by = py + pw * 2.13 + 0.5
    pw_photo = cx - 0.2 - 0.6
    pic_rect(s, photo_avion, 0.6, by, pw_photo, 1.3, radius=0.12, shadow_on=True)
    text(s, 0.6, by + 1.33, pw_photo, 0.25, "Tournage simulateur avion de chasse — I-WAY, mai 2026", size=8.5, color=INK2)
    fy = 6.86; fx = 0.6
    pill(s, fx, fy, 0.72, 0.27, "Formats", size=8, fill=INK, line=INK, color=WHITE, bold=True); fx += 0.72 + 0.07
    for lab, w in (("Témoignages", 0.98), ("I-Quiz", 0.6), ("Jeux concours", 1.08), ("UGC", 0.5), ("Promo B2B", 0.88), ("Portraits staff", 1.08), ("Mini albums", 0.95)):
        pill(s, fx, fy, w, 0.27, lab, size=7.5); fx += w + 0.06
    # mockup vidéo
    vx, vy, vw, vh = 7.85, 0.95, 4.9, 6.0
    pic_rect(s, reels, vx, vy, vw, vh, radius=0.16, shadow_on=True)
    pill(s, vx + 0.25, vy + vh - 0.62, 2.5, 0.36, "▶   Reels & TikTok · voir les vidéos", size=9.5, fill=INK, line=INK, color=WHITE, bold=True, link="https://www.tiktok.com/@iwayofficiel")
    pill(s, vx + 2.9, vy + vh - 0.62, 1.75, 0.36, "@iwayofficiel", size=9.5, fill=WHITE, line=WHITE, color=INK, bold=True, link="https://www.instagram.com/iwayofficiel/")

    # ════════ SLIDE 3 — Résultats ════════
    s = prs.slides.add_slide(blank); background(s); wordmark(s); signature(s, x=9.15, y=0.38, align=PP_ALIGN.RIGHT)
    text(s, 0.6, 0.42, 7.5, 0.6, "Les résultats", font=H_FONT, size=32, bold=True)
    text(s, 0.6, 1.02, 8.2, 0.35, "Septembre 2022 → juillet 2026 · relevés de fin de mois, Meta Ads et planning éditorial", size=11, color=INK2)
    kpis = [
        ("21 742", "abonnés Instagram", "866 en sept. 2022 · ×25"),
        ("13 772", "abonnés TikTok", "compte créé en 2022, parti de zéro"),
        ("56 000", "communauté totale, 5 réseaux", "19 500 en 2022 · ×2,9"),
        ("7,4 M", "impressions payantes Meta", "16,3 k€ depuis oct. 2023 · CPM 2,20 €"),
    ]
    kx = 0.6; kw = 2.9; kg = 0.18
    for big, lab, sub in kpis:
        rect(s, kx, 1.45, kw, 1.22, fill=WHITE, line=LINE, radius=0.14, shadow_on=True)
        text(s, kx + 0.22, 1.5, kw - 0.4, 0.55, big, font=H_FONT, size=26, bold=True)
        text(s, kx + 0.22, 2.04, kw - 0.4, 0.28, lab, size=10, bold=True, color=INK)
        text(s, kx + 0.22, 2.31, kw - 0.4, 0.3, sub, size=9, color=INK2)
        kx += kw + kg

    # graphique abonnés
    rect(s, 0.6, 2.9, 6.4, 3.75, fill=WHITE, line=LINE, radius=0.16, shadow_on=True)
    text(s, 0.85, 3.05, 4.0, 0.3, "Abonnés en fin de mois", font=H_FONT, size=12, bold=True)
    text(s, 0.85, 3.32, 5.5, 0.25, "Instagram et TikTok, sept. 2022 → juil. 2026 (relevés Looker Studio)", size=9, color=INK2)
    cd = CategoryChartData(); cd.categories = MONTHS
    cd.add_series("Instagram", IG); cd.add_series("TikTok", TT)
    gf = s.shapes.add_chart(XL_CHART_TYPE.LINE, Inches(0.75), Inches(3.6), Inches(6.1), Inches(2.95), cd)
    ch = gf.chart
    ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.TOP; ch.legend.include_in_layout = False
    ch.legend.font.size = Pt(9); ch.legend.font.name = B_FONT; ch.legend.font.color.rgb = INK2
    ch.font.name = B_FONT
    for ser, col, w in zip(ch.plots[0].series, (ACCENT_INK, ACCENT), (2.25, 2.25)):
        ser.format.line.color.rgb = col; ser.format.line.width = Pt(w); ser.smooth = False
        ser.marker.style = None
        from pptx.enum.chart import XL_MARKER_STYLE
        ser.marker.style = XL_MARKER_STYLE.NONE
    ca = ch.category_axis; va = ch.value_axis
    ca.tick_labels.font.size = Pt(8); ca.tick_labels.font.color.rgb = INK2
    ca.format.line.color.rgb = LINE_STRONG; ca.has_major_gridlines = False
    ca.tick_label_position = XL_TICK_LABEL_POSITION.LOW
    va.tick_labels.font.size = Pt(8); va.tick_labels.font.color.rgb = INK2
    va.has_major_gridlines = True; va.major_gridlines.format.line.color.rgb = LINE
    va.format.line.fill.background(); va.maximum_scale = 25000; va.minimum_scale = 0; va.major_unit = 5000
    va.tick_labels.number_format = '# ##0'; va.tick_labels.number_format_is_linked = False
    # un libellé de mois sur six
    catAx = ch._chartSpace.find(".//" + qn("c:catAx"))
    nml = catAx.find(qn("c:noMultiLvlLbl"))
    skip = etree.Element(qn("c:tickLblSkip")); skip.set("val", "6")
    mark = etree.Element(qn("c:tickMarkSkip")); mark.set("val", "6")
    if nml is not None:
        nml.addprevious(skip); nml.addprevious(mark)
    else:
        catAx.append(skip); catAx.append(mark)
    # annotations : dernier point
    text(s, 4.55, 3.4, 2.3, 0.3, "21 742 abonnés Instagram", size=8.5, bold=True, color=ACCENT_INK, align=PP_ALIGN.RIGHT)
    text(s, 4.55, 4.75, 2.3, 0.3, "13 772 abonnés TikTok", size=8.5, bold=True, color=ACCENT_INK, align=PP_ALIGN.RIGHT)

    # mockup mac
    mx, my, mw = 7.3, 2.95, 5.4
    mh = macbook(s, mx, my, mw, dash)
    text(s, mx - 0.3, my + mh + 0.12, mw + 0.6, 0.3, "Dashboard de reporting mensuel — Meta Ads, Instagram, TikTok, LinkedIn, YouTube", size=9, color=INK2, align=PP_ALIGN.CENTER)
    # autres réseaux
    text(s, 0.6, 6.8, 11.2, 0.5, [
        {"runs": [
            {"t": "LinkedIn ", "bold": True}, {"t": "440 → 819 abonnés (+86 %)   ·   "},
            {"t": "YouTube ", "bold": True}, {"t": "740 → 936 abonnés (+26 %)   ·   "},
            {"t": "Facebook ", "bold": True}, {"t": "18 219 → 18 732 fans, sans budget média"},
        ], "size": 9, "color": INK2, "space_after": 2},
        {"runs": [
            {"t": "Meta Ads, 12 derniers mois ", "bold": True}, {"t": "2,1 M impressions · 1,45 M personnes touchées · 79 570 clics · CTR 3,8 %   ·   "},
            {"t": "≈ 1 000 contenus ", "bold": True}, {"t": "planifiés et produits depuis oct. 2023"},
        ], "size": 9, "color": INK2},
    ])

    prs.save(OUT)
    print("écrit", OUT, os.path.getsize(OUT) // 1024, "Ko")

if __name__ == "__main__":
    build()
