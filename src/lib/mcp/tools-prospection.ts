import "server-only";

import {
  ENROLLMENT_STATUS_LABELS,
  GENERATED_POST_FORMAT_LABELS,
  GENERATED_POST_STATUS_LABELS,
  INTERACTION_TYPE_LABELS,
  OUTREACH_CHANNEL_LABELS,
  PROSPECT_STATUS_LABELS,
  type EnrollmentStatus,
  type GeneratedPostFormat,
  type GeneratedPostStatus,
  type InteractionType,
  type OutreachChannel,
  type ProspectStatus,
} from "@/lib/antidotes/types";

import type { ToolDefinition } from "./protocol";
import { admin, ownerContext, rows, text } from "./shared";

/**
 * Le pôle Antidotes : prospection et personal branding.
 *
 * Rien d'ici n'écrit à un prospect ni ne publie : une note reste au journal,
 * un brouillon LinkedIn attend d'être approuvé dans l'application.
 */

type ProspectLine = {
  id: string;
  company_name: string;
  status: ProspectStatus;
  score: number;
  city: string | null;
  sector: string | null;
  website: string | null;
  ads_active: boolean;
  last_contact_at: string | null;
  notes: string | null;
};

export const PROSPECTION_TOOLS: ToolDefinition[] = [
  {
    name: "lire_pipeline_prospects",
    description:
      "Le pipeline de prospection de l'agence : prospects par statut et score, avec contact principal. Avec prospect_id : la fiche complète, contacts et journal.",
    inputSchema: {
      type: "object",
      properties: {
        statut: {
          type: "string",
          description: "Filtre : to_qualify, qualified, no_contact_found, contacted, replied, meeting, won, lost.",
        },
        prospect_id: { type: "string", description: "Identifiant d'un prospect, pour sa fiche." },
      },
    },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const prospectId = text(args.prospect_id);

      if (prospectId) {
        const prospect = rows<ProspectLine>(
          await client
            .from("antidotes_prospects")
            .select("id, company_name, status, score, city, sector, website, ads_active, last_contact_at, notes")
            .eq("org_id", owner.orgId)
            .eq("id", prospectId),
          "Lecture du prospect",
        )[0];
        if (!prospect) return { text: "Prospect introuvable.", isError: true };
        const [contactResult, interactionResult] = await Promise.all([
          client
            .from("antidotes_contacts")
            .select("first_name, last_name, role, email, email_status, linkedin_url, is_primary, outreach_channel, opted_out")
            .eq("org_id", owner.orgId)
            .eq("prospect_id", prospect.id),
          client
            .from("antidotes_interactions")
            .select("type, payload, occurred_at")
            .eq("org_id", owner.orgId)
            .eq("prospect_id", prospect.id)
            .order("occurred_at", { ascending: false })
            .limit(30),
        ]);
        const contacts = rows<{
          first_name: string | null;
          last_name: string | null;
          role: string | null;
          email: string | null;
          email_status: string;
          linkedin_url: string | null;
          is_primary: boolean;
          outreach_channel: OutreachChannel;
          opted_out: boolean;
        }>(contactResult, "Lecture des contacts");
        const interactions = rows<{ type: InteractionType; payload: Record<string, unknown>; occurred_at: string }>(
          interactionResult,
          "Lecture du journal",
        );
        return {
          text: [
            `# ${prospect.company_name} — ${PROSPECT_STATUS_LABELS[prospect.status]} · score ${prospect.score}`,
            [prospect.sector, prospect.city, prospect.website, prospect.ads_active ? "pubs actives" : null]
              .filter(Boolean)
              .join(" · "),
            prospect.notes ? `Notes : ${prospect.notes}` : null,
            "## Contacts",
            contacts
              .map(
                (c) =>
                  `- ${c.is_primary ? "★ " : ""}${[c.first_name, c.last_name].filter(Boolean).join(" ") || "?"}${c.role ? `, ${c.role}` : ""} · ${c.email ?? "pas d'adresse"} (${c.email_status}) · canal ${OUTREACH_CHANNEL_LABELS[c.outreach_channel]}${c.opted_out ? " · DÉSINSCRIT" : ""}${c.linkedin_url ? ` · ${c.linkedin_url}` : ""}`,
              )
              .join("\n") || "Aucun.",
            "## Journal",
            interactions
              .map(
                (i) =>
                  `- ${i.occurred_at.slice(0, 16).replace("T", " ")} · ${INTERACTION_TYPE_LABELS[i.type]}${typeof i.payload?.text === "string" ? ` : ${i.payload.text}` : ""}`,
              )
              .join("\n") || "Vide.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        };
      }

      let query = client
        .from("antidotes_prospects")
        .select("id, company_name, status, score, city, sector, website, ads_active, last_contact_at, notes")
        .eq("org_id", owner.orgId)
        .order("score", { ascending: false })
        .limit(150);
      if (text(args.statut)) query = query.eq("status", text(args.statut) as ProspectStatus);
      const prospects = rows<ProspectLine>(await query, "Lecture du pipeline");
      if (prospects.length === 0) return { text: "Aucun prospect." };
      return {
        text: prospects
          .map(
            (p) =>
              `- ${p.company_name} · ${PROSPECT_STATUS_LABELS[p.status]} · score ${p.score}${p.city ? ` · ${p.city}` : ""}${p.last_contact_at ? ` · dernier contact ${p.last_contact_at.slice(0, 10)}` : ""} · id ${p.id}`,
          )
          .join("\n"),
      };
    },
  },

  {
    name: "noter_prospect",
    description: "Ajoute une note (ou la trace d'un appel) au journal d'un prospect. Rien n'est envoyé au prospect.",
    inputSchema: {
      type: "object",
      properties: {
        prospect_id: { type: "string", description: "Identifiant (lire_pipeline_prospects)." },
        texte: { type: "string", description: "La note." },
        type: { type: "string", enum: ["note", "call"], description: "note (défaut) ou call (appel)." },
      },
      required: ["prospect_id", "texte"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const prospect = rows<{ id: string; company_name: string }>(
        await client
          .from("antidotes_prospects")
          .select("id, company_name")
          .eq("org_id", owner.orgId)
          .eq("id", text(args.prospect_id)),
        "Lecture du prospect",
      )[0];
      if (!prospect) return { text: "Prospect introuvable.", isError: true };
      const type = text(args.type) === "call" ? "call" : "note";
      const { error } = await client.from("antidotes_interactions").insert({
        org_id: owner.orgId,
        prospect_id: prospect.id,
        contact_id: null,
        type,
        payload: { text: text(args.texte) },
      } as never);
      if (error) throw new Error(`Note refusée : ${error.message}`);
      return { text: `${type === "call" ? "Appel noté" : "Note ajoutée"} sur ${prospect.company_name}.` };
    },
  },

  {
    name: "lire_sequences",
    description:
      "Les séquences d'emails de prospection : étapes (délai, objet, corps) et inscriptions (contact, étape, état, prochain envoi).",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    run: async () => {
      const client = admin();
      const owner = await ownerContext(client);
      const [sequenceResult, stepResult, enrollmentResult] = await Promise.all([
        client.from("antidotes_sequences").select("id, name, is_active").eq("org_id", owner.orgId).order("name"),
        client
          .from("antidotes_sequence_steps")
          .select("sequence_id, position, delay_days, subject_template, body_template")
          .eq("org_id", owner.orgId)
          .order("position"),
        client
          .from("antidotes_sequence_enrollments")
          .select("sequence_id, contact_id, current_step, status, next_send_at, channel")
          .eq("org_id", owner.orgId),
      ]);
      const sequences = rows<{ id: string; name: string; is_active: boolean }>(sequenceResult, "Lecture des séquences");
      const steps = rows<{
        sequence_id: string;
        position: number;
        delay_days: number;
        subject_template: string;
        body_template: string;
      }>(stepResult, "Lecture des étapes");
      const enrollments = rows<{
        sequence_id: string;
        contact_id: string;
        current_step: number;
        status: EnrollmentStatus;
        next_send_at: string | null;
        channel: OutreachChannel;
      }>(enrollmentResult, "Lecture des inscriptions");
      if (sequences.length === 0) return { text: "Aucune séquence." };

      const contactIds = [...new Set(enrollments.map((e) => e.contact_id))];
      const contacts = contactIds.length
        ? new Map(
            rows<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>(
              await client
                .from("antidotes_contacts")
                .select("id, first_name, last_name, email")
                .eq("org_id", owner.orgId)
                .in("id", contactIds),
              "Lecture des contacts",
            ).map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "?"]),
          )
        : new Map<string, string>();

      return {
        text: sequences
          .map((sequence) =>
            [
              `# ${sequence.name}${sequence.is_active ? "" : " (inactive)"}`,
              ...steps
                .filter((s) => s.sequence_id === sequence.id)
                .map((s) => `## Étape ${s.position + 1} — J+${s.delay_days}\nObjet : ${s.subject_template}\n${s.body_template}`),
              "## Inscriptions",
              enrollments
                .filter((e) => e.sequence_id === sequence.id)
                .map(
                  (e) =>
                    `- ${contacts.get(e.contact_id) ?? "?"} · ${OUTREACH_CHANNEL_LABELS[e.channel]} · étape ${e.current_step + 1} · ${ENROLLMENT_STATUS_LABELS[e.status]}${e.next_send_at ? ` · prochain envoi ${e.next_send_at.slice(0, 16).replace("T", " ")}` : ""}`,
                )
                .join("\n") || "Aucune.",
            ].join("\n\n"),
          )
          .join("\n\n---\n\n"),
      };
    },
  },

  {
    name: "lire_inbound",
    description:
      "Le personal branding : mes brouillons (posts LinkedIn, scripts de reel et de vidéo YouTube) et les meilleures publications relevées par la veille, avec leurs chiffres.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    run: async () => {
      const client = admin();
      const owner = await ownerContext(client);
      const [draftResult, referenceResult] = await Promise.all([
        client
          .from("antidotes_generated_posts")
          .select("id, topic, content, status, format, scheduled_at, created_at")
          .eq("org_id", owner.orgId)
          .in("status", ["draft", "approved"])
          .order("created_at", { ascending: false })
          .limit(20),
        client
          .from("antidotes_reference_posts")
          .select("platform, author_handle, content, transcript, url, metrics, is_mine, published_at")
          .eq("org_id", owner.orgId)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(40),
      ]);
      const drafts = rows<{
        id: string;
        topic: string | null;
        content: string;
        status: GeneratedPostStatus;
        format: GeneratedPostFormat;
        scheduled_at: string | null;
      }>(draftResult, "Lecture des brouillons");
      const references = rows<{
        platform: string;
        author_handle: string | null;
        content: string;
        transcript: string | null;
        url: string | null;
        metrics: Record<string, number>;
        is_mine: boolean;
        published_at: string | null;
      }>(referenceResult, "Lecture de la veille");

      return {
        text: [
          "# Brouillons",
          drafts
            .map(
              (d) =>
                `## ${d.topic ?? "(sans sujet)"} — ${GENERATED_POST_FORMAT_LABELS[d.format]} · ${GENERATED_POST_STATUS_LABELS[d.status]}${d.scheduled_at ? ` · prévu ${d.scheduled_at.slice(0, 16).replace("T", " ")}` : ""} · id ${d.id}\n${d.content}`,
            )
            .join("\n\n") || "Aucun.",
          "# Veille récente",
          references
            .map((r) => {
              const metrics = Object.entries(r.metrics ?? {})
                .filter(([, value]) => typeof value === "number")
                .map(([key, value]) => `${key} ${value}`)
                .join(", ");
              return `- ${r.published_at?.slice(0, 10) ?? "?"} · ${r.platform} · ${r.is_mine ? "moi" : r.author_handle ?? "?"}${metrics ? ` · ${metrics}` : ""}${r.url ? ` · ${r.url}` : ""}\n  ${(r.transcript || r.content).slice(0, 400).replace(/\s+/g, " ")}`;
            })
            .join("\n") || "Vide.",
        ].join("\n\n"),
      };
    },
  },

  {
    name: "creer_brouillon_linkedin",
    description:
      "Enregistre un brouillon dans le studio inbound (post LinkedIn, script de reel ou de vidéo YouTube), statut Brouillon. Rien n'est publié : l'approbation et la publication se font dans l'application.",
    inputSchema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Le sujet, court." },
        contenu: { type: "string", description: "Le texte complet." },
        forme: {
          type: "string",
          enum: ["linkedin_post", "reel_script", "youtube_script"],
          description: "Défaut : linkedin_post.",
        },
      },
      required: ["sujet", "contenu"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const owner = await ownerContext(client);
      const format: GeneratedPostFormat = (["linkedin_post", "reel_script", "youtube_script"] as const).includes(
        text(args.forme) as GeneratedPostFormat,
      )
        ? (text(args.forme) as GeneratedPostFormat)
        : "linkedin_post";
      const created = rows<{ id: string }>(
        await client
          .from("antidotes_generated_posts")
          .insert({
            org_id: owner.orgId,
            topic: text(args.sujet),
            // Un textarea ou un modèle peut rendre du CRLF : LinkedIn le recevrait tel quel.
            content: text(args.contenu).replace(/\r\n?/g, "\n"),
            status: "draft",
            format,
            examples: [],
          } as never)
          .select("id"),
        "Brouillon refusé",
      )[0];
      return { text: `${GENERATED_POST_FORMAT_LABELS[format]} enregistré en brouillon (id ${created?.id}).` };
    },
  },
];
