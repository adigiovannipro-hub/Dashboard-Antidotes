import { plainText } from "@/components/brand/rich";
import type { Locale } from "@/i18n/locale";
import { fr } from "@/i18n/fr";
import { QUESTIONS, type Answers, type QuestionId, type Temperature } from "@/lib/questionnaire";
import { escapeHtml, whenWithZone } from "./format";

/**
 * Les courriels du site. Chacun existe en HTML et en texte brut, FR et EN.
 * Le gabarit est celui du Verre clair de la charte (9/10/2026) : fond
 * Craie, carte blanche, Encre ; le logotype en tête avec son point Encre
 * (sur clair, jamais Signal), le vert seulement en filet et dans les liens.
 * Un courriel sombre se lit mal dans la moitié des clients.
 */
export type Rendered = { subject: string; html: string; text: string };

const OWNER = "Alessandro Di Giovanni";

/** Encre, graphite et craie de la palette ; le filet descend la gamme verte, de 700 à 200. */
const INK = "#141414";
const GRAPHITE = "#5C5F58";
const CHALK = "#F7F8F4";
const SIGNAL = "#22E05B";
const FOREST = "#0E4A26";
const BAND = "linear-gradient(90deg,#22E05B,#7AEC9D,#A7F3BD)";
/** Le logotype dessiné, servi par le site : en texte, la police de repli du client l'élargissait et l'alourdissait. */
const LOGO_URL = "https://antidotes.agency/brand/logo-encre@2x.png";
const SIGNATURE_FR = "Alessandro Di Giovanni\nFreelance social media & IA — Antidotes\nhttps://antidotes.agency";
const SIGNATURE_EN = "Alessandro Di Giovanni\nFreelance social media & AI — Antidotes\nhttps://antidotes.agency";

function layout(options: { title: string; paragraphs: string[]; cta?: { label: string; href: string }; footer: string }): string {
  // Les liens des paragraphes prennent le vert forêt : sans couleur posée, chaque client les peint en bleu.
  const body = options.paragraphs
    .map((p) => p.replaceAll("<a href=", `<a style="color:${FOREST};text-decoration:underline" href=`))
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${p}</p>`)
    .join("");
  const cta = options.cta
    ? `<p style="margin:24px 0"><a href="${options.cta.href}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;font-size:15px">${escapeHtml(options.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:${CHALK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CHALK};padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td height="4" bgcolor="${SIGNAL}" style="height:4px;line-height:4px;font-size:0;background-color:${SIGNAL};background-image:${BAND}">&nbsp;</td></tr>
<tr><td style="padding:34px 36px 8px"><img src="${LOGO_URL}" width="133" height="21" alt="antidotes." style="display:block;border:0;outline:none;height:21px;width:133px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.03em;color:${INK}">
<h1 style="margin:20px 0 20px;font-family:'Funnel Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:${INK};font-weight:600">${escapeHtml(options.title)}</h1>${body}${cta}</td></tr>
<tr><td style="padding:8px 36px 32px;font-size:13px;line-height:1.5;color:${GRAPHITE};white-space:pre-line">${escapeHtml(options.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

function text(options: { title: string; paragraphs: string[]; cta?: { label: string; href: string }; footer: string }): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  return [options.title, "", ...options.paragraphs.map(strip), options.cta ? `${options.cta.label} : ${options.cta.href}` : "", "", options.footer]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

function render(locale: Locale, options: { subject: string; title: string; paragraphs: string[]; cta?: { label: string; href: string } }): Rendered {
  const footer = locale === "fr" ? SIGNATURE_FR : SIGNATURE_EN;
  return { subject: options.subject, html: layout({ ...options, footer }), text: text({ ...options, footer }) };
}

/** Le libellé français d'une réponse, pour les notifications du propriétaire. */
export function describeAnswers(answers: Answers): string[] {
  const lines: string[] = [];
  for (const question of QUESTIONS) {
    const q = fr.funnel.questions[question.id as QuestionId];
    const value = answers[question.id];
    const values = Array.isArray(value) ? value : value ? [value] : [];
    const labels = values.map((v) => q.options[v] ?? v).join(", ");
    // Le titre porte une touche manuscrite (`_mots_`) : le courriel la lit sans marque.
    lines.push(`${plainText(q.title)} → ${labels || "—"}`);
  }
  return lines;
}

const TEMPERATURE_FR: Record<Temperature, string> = { chaud: "Chaud 🔥", tiede: "Tiède", froid: "Froid" };

// --- Courriels au prospect ---------------------------------------------------

export function leadWelcome(locale: Locale, options: { firstName: string; continueUrl: string }): Rendered {
  const name = options.firstName; // le titre est échappé une seule fois, par le gabarit
  if (locale === "fr") {
    return render("fr", {
      subject: "Votre note social media est en préparation",
      title: `Merci ${name}, c'est bien reçu.`,
      paragraphs: [
        "Vos réponses alimentent le calcul de votre note de gestion et de présence social media, de 1 à 10.",
        "Elle vous est présentée en rendez-vous — trente minutes en visio — avec le détail par axe et les trois leviers qui la feraient monter.",
        "Si vous n'avez pas encore choisi votre créneau, c'est ici :",
      ],
      cta: { label: "Choisir mon créneau", href: options.continueUrl },
    });
  }
  return render("en", {
    subject: "Your social media score is being prepared",
    title: `Thanks ${name}, we've got it.`,
    paragraphs: [
      "Your answers feed the calculation of your social media management and presence score, from 1 to 10.",
      "It's presented during your call — thirty minutes on video — with the breakdown by axis and the three levers that would raise it.",
      "If you haven't picked your time yet, it's right here:",
    ],
    cta: { label: "Pick my time", href: options.continueUrl },
  });
}

export function coldTips(locale: Locale, options: { firstName: string; continueUrl: string }): Rendered {
  const name = options.firstName; // le titre est échappé une seule fois, par le gabarit
  if (locale === "fr") {
    return render("fr", {
      subject: "Trois gestes pour votre présence social media",
      title: `${name}, trois gestes qui comptent dès cette semaine.`,
      paragraphs: [
        "<strong>1. Un rythme tenable, écrit noir sur blanc.</strong> Deux publications par semaine tenues pendant trois mois valent mieux que dix en janvier et rien en mars. Choisissez un jour fixe, un format fixe, et tenez-le.",
        "<strong>2. Une mesure, une seule.</strong> Chaque mois, notez la portée de vos trois meilleures publications et pourquoi elles ont marché. Au bout de trois mois, vous saurez quoi reproduire.",
        "<strong>3. Un contexte de marque en une page.</strong> Qui vous êtes, à qui vous parlez, ce que vous ne dites jamais. Tout ce que vous publiez — ou faites écrire, par un humain ou une IA — part de là.",
        "Quand vous voudrez aller plus loin, le rendez-vous reste ouvert :",
      ],
      cta: { label: "Prendre rendez-vous", href: options.continueUrl },
    });
  }
  return render("en", {
    subject: "Three moves for your social media presence",
    title: `${name}, three moves that matter this week.`,
    paragraphs: [
      "<strong>1. A sustainable rhythm, written down.</strong> Two posts a week kept up for three months beat ten in January and none in March. Pick a fixed day, a fixed format, and stick to it.",
      "<strong>2. One measure, only one.</strong> Each month, note the reach of your three best posts and why they worked. After three months, you'll know what to repeat.",
      "<strong>3. A one-page brand context.</strong> Who you are, who you talk to, what you never say. Everything you publish — or have written, by a human or an AI — starts there.",
      "When you want to go further, the call is still open:",
    ],
    cta: { label: "Book a call", href: options.continueUrl },
  });
}

export type BookingMailInput = {
  firstName: string;
  start: Date;
  end: Date;
  prospectTimeZone: string;
  ownerTimeZone: string;
  meetUrl: string | null;
  icsUrl: string;
  googleUrl: string;
  cancelUrl: string;
};

export function bookingConfirmation(locale: Locale, b: BookingMailInput): Rendered {
  const whenProspect = whenWithZone(b.start, b.prospectTimeZone, locale);
  const whenOwner = whenWithZone(b.start, b.ownerTimeZone, locale);
  const name = b.firstName;
  if (locale === "fr") {
    return render("fr", {
      subject: `Votre rendez-vous Antidotes — ${whenProspect}`,
      title: `${name}, c'est confirmé.`,
      paragraphs: [
        `<strong>Quand :</strong> ${escapeHtml(whenProspect)}<br><span style="color:${GRAPHITE}">Soit ${escapeHtml(whenOwner)} pour Alessandro.</span>`,
        b.meetUrl
          ? `<strong>Où :</strong> en visio, <a href="${b.meetUrl}">${escapeHtml(b.meetUrl)}</a>`
          : "<strong>Où :</strong> en visio — le lien vous parvient dans un second courriel, avant le rendez-vous.",
        `<strong>Au programme :</strong> votre note de gestion et de présence social media sur 10, expliquée axe par axe, et les trois leviers prioritaires pour votre marque. Si vous avez accès à vos statistiques, ayez-les sous la main.`,
        `Ajouter à votre agenda : <a href="${b.googleUrl}">Google Agenda</a> · <a href="${b.icsUrl}">fichier .ics</a>`,
        `Un empêchement ? <a href="${b.cancelUrl}">Annuler ou modifier le rendez-vous</a>.`,
      ],
    });
  }
  return render("en", {
    subject: `Your Antidotes call — ${whenProspect}`,
    title: `${name}, you're booked.`,
    paragraphs: [
      `<strong>When:</strong> ${escapeHtml(whenProspect)}<br><span style="color:${GRAPHITE}">That's ${escapeHtml(whenOwner)} for Alessandro.</span>`,
      b.meetUrl
        ? `<strong>Where:</strong> on video, <a href="${b.meetUrl}">${escapeHtml(b.meetUrl)}</a>`
        : "<strong>Where:</strong> on video — the link arrives in a second email before the call.",
      `<strong>On the agenda:</strong> your social media management and presence score out of 10, explained axis by axis, and the three priority levers for your brand. If you have access to your statistics, keep them at hand.`,
      `Add to your calendar: <a href="${b.googleUrl}">Google Calendar</a> · <a href="${b.icsUrl}">.ics file</a>`,
      `Can't make it? <a href="${b.cancelUrl}">Cancel or reschedule</a>.`,
    ],
  });
}

export function bookingReminder(locale: Locale, b: BookingMailInput): Rendered {
  const whenProspect = whenWithZone(b.start, b.prospectTimeZone, locale);
  const name = b.firstName;
  if (locale === "fr") {
    return render("fr", {
      subject: `Demain — votre rendez-vous Antidotes, ${whenProspect}`,
      title: `${name}, à demain.`,
      paragraphs: [
        `<strong>Quand :</strong> ${escapeHtml(whenProspect)}`,
        b.meetUrl ? `<strong>Lien de visio :</strong> <a href="${b.meetUrl}">${escapeHtml(b.meetUrl)}</a>` : "Le lien de visio vous parvient avant le rendez-vous.",
        `Un empêchement ? <a href="${b.cancelUrl}">Annuler ou modifier</a>.`,
      ],
    });
  }
  return render("en", {
    subject: `Tomorrow — your Antidotes call, ${whenProspect}`,
    title: `${name}, see you tomorrow.`,
    paragraphs: [
      `<strong>When:</strong> ${escapeHtml(whenProspect)}`,
      b.meetUrl ? `<strong>Video link:</strong> <a href="${b.meetUrl}">${escapeHtml(b.meetUrl)}</a>` : "The video link arrives before the call.",
      `Can't make it? <a href="${b.cancelUrl}">Cancel or reschedule</a>.`,
    ],
  });
}

export function bookingCancelled(locale: Locale, options: { firstName: string; start: Date; prospectTimeZone: string; continueUrl: string }): Rendered {
  const when = whenWithZone(options.start, options.prospectTimeZone, locale);
  const name = options.firstName; // le titre est échappé une seule fois, par le gabarit
  if (locale === "fr") {
    return render("fr", {
      subject: `Rendez-vous annulé — ${when}`,
      title: `${name}, votre rendez-vous est annulé.`,
      paragraphs: [`Le créneau du ${escapeHtml(when)} est libéré.`, "Vous pouvez en reprendre un autre à tout moment :"],
      cta: { label: "Choisir un nouveau créneau", href: options.continueUrl },
    });
  }
  return render("en", {
    subject: `Call cancelled — ${when}`,
    title: `${name}, your call is cancelled.`,
    paragraphs: [`The ${escapeHtml(when)} slot has been released.`, "You can pick another one at any time:"],
    cta: { label: "Pick a new time", href: options.continueUrl },
  });
}

// --- Notifications au propriétaire (toujours en français) ----------------------

export function ownerLeadCreated(options: { email: string; firstName: string; locale: Locale; utm: Record<string, string>; timezone: string | null }): Rendered {
  const utm = Object.entries(options.utm).map(([k, v]) => `${k}=${v}`).join(", ") || "aucun";
  return render("fr", {
    subject: `Nouveau lead — ${options.email}`,
    title: "Un nouveau lead vient d'entrer dans le tunnel.",
    paragraphs: [
      `<strong>${escapeHtml(options.firstName)}</strong> — ${escapeHtml(options.email)}<br>Langue : ${options.locale.toUpperCase()} · Fuseau : ${escapeHtml(options.timezone ?? "inconnu")}<br>UTM : ${escapeHtml(utm)}`,
      "Il remplit le questionnaire ; la notification suivante portera ses réponses et sa qualification.",
    ],
  });
}

export function ownerQuestionnaire(options: { email: string; firstName: string; answers: Answers; score: number | null; temperature: Temperature | null }): Rendered {
  const temp = options.temperature ? TEMPERATURE_FR[options.temperature] : "—";
  return render("fr", {
    subject: `Questionnaire terminé — ${temp} — ${options.email}`,
    title: `${options.firstName} a terminé le questionnaire.`,
    paragraphs: [
      `<strong>Qualification :</strong> ${temp}<br><strong>Note calculée :</strong> ${options.score ?? "—"} / 10 <span style="color:${GRAPHITE}">(à dévoiler en rendez-vous, jamais envoyée au prospect)</span>`,
      describeAnswers(options.answers).map(escapeHtml).join("<br>"),
    ],
  });
}

export function ownerBooking(options: {
  email: string;
  name: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  start: Date;
  prospectTimeZone: string;
  ownerTimeZone: string;
  meetUrl: string | null;
  calendarCreated: boolean;
  answers: Answers | null;
  score: number | null;
  temperature: Temperature | null;
  cancelUrl: string;
}): Rendered {
  const temp = options.temperature ? TEMPERATURE_FR[options.temperature] : "—";
  const whenOwner = whenWithZone(options.start, options.ownerTimeZone, "fr");
  const whenProspect = whenWithZone(options.start, options.prospectTimeZone, "fr");
  return render("fr", {
    subject: `RDV pris — ${whenOwner} — ${options.name} (${temp})`,
    title: `${options.name} a réservé un rendez-vous.`,
    paragraphs: [
      `<strong>Quand :</strong> ${escapeHtml(whenOwner)}<br><span style="color:${GRAPHITE}">Pour le prospect : ${escapeHtml(whenProspect)}</span>`,
      `<strong>Qui :</strong> ${escapeHtml(options.name)}${options.company ? ` · ${escapeHtml(options.company)}` : ""}<br>${escapeHtml(options.email)}${options.phone ? ` · ${escapeHtml(options.phone)}` : ""}`,
      options.calendarCreated
        ? `<strong>Agenda :</strong> événement créé${options.meetUrl ? `, visio <a href="${options.meetUrl}">${escapeHtml(options.meetUrl)}</a>` : ""}.`
        : `<strong>Agenda :</strong> Google Calendar n'est pas branché — l'événement n'a pas été créé automatiquement.${options.meetUrl ? ` Lien de repli : <a href="${options.meetUrl}">${escapeHtml(options.meetUrl)}</a>` : ""}`,
      `<strong>Qualification :</strong> ${temp} · <strong>Note :</strong> ${options.score ?? "—"} / 10`,
      options.notes ? `<strong>Sujet à préparer :</strong> ${escapeHtml(options.notes)}` : "",
      options.answers ? describeAnswers(options.answers).map(escapeHtml).join("<br>") : "Questionnaire non terminé.",
      `<a href="${options.cancelUrl}">Lien d'annulation du prospect</a>`,
    ].filter(Boolean),
  });
}

export function ownerCancelled(options: { email: string; name: string | null; start: Date; ownerTimeZone: string }): Rendered {
  const when = whenWithZone(options.start, options.ownerTimeZone, "fr");
  return render("fr", {
    subject: `RDV annulé — ${when} — ${options.name ?? options.email}`,
    title: "Un rendez-vous a été annulé.",
    paragraphs: [`${escapeHtml(options.name ?? "")} — ${escapeHtml(options.email)}<br>Créneau libéré : ${escapeHtml(when)}`],
  });
}

export { OWNER };
