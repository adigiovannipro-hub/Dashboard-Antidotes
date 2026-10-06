"use server";

import { z } from "zod";

import { sendAccessLink } from "@/lib/access/send-access";
import { siteOrigin } from "@/lib/access/site-origin";
import { createAdminClient } from "@/lib/supabase/server";

export type LoginLinkResult =
  /** `fallback` : le courriel n'est pas parti — le navigateur passe par Supabase. */
  | { ok: true; fallback: boolean }
  | { ok: false; error: string };

const loginSchema = z.object({
  email: z.email("Adresse email invalide.").transform((value) => value.trim().toLowerCase()),
  next: z.string().max(500).optional(),
});

/**
 * Le lien de connexion demandé depuis `/login`.
 *
 * Il partait par la boîte d'envoi de Supabase, qui ne délivre qu'aux membres
 * de l'équipe du projet : un client invité ne recevait rien. Il part
 * désormais par la boîte Gmail de l'agence, comme les invitations.
 *
 * **Seulement vers une adresse connue** — un compte, une invitation en cours
 * ou une inscription Academy — et la réponse est la même dans tous les cas :
 * la page ne dit pas si une adresse a un accès. Une adresse inconnue ne reçoit
 * rien et aucun compte ne se crée.
 *
 * Boîte d'envoi indisponible : `fallback`, et le formulaire retombe sur
 * l'envoi de Supabase — qui délivre au moins à l'agence. Sans ce repli, une
 * boîte Gmail déconnectée fermerait l'application à son propre propriétaire.
 */
export async function requestLoginLink(input: {
  email: string;
  next?: string;
}): Promise<LoginLinkResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Adresse email invalide." };
  }
  const { email } = parsed.data;
  // Un chemin interne seulement : jamais de redirection vers un domaine tiers.
  const next = parsed.data.next ?? "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [{ data: profile }, { data: invitation }, { data: enrollment }] = await Promise.all([
    admin.from("profiles").select("id, first_name").ilike("email", email).maybeSingle(),
    admin
      .from("invitations")
      .select("id")
      .ilike("email", email)
      .is("accepted_at", null)
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle(),
    admin.from("academy_enrollments").select("id").ilike("email", email).limit(1).maybeSingle(),
  ]);

  if (!profile && !invitation && !enrollment) return { ok: true, fallback: false };

  const sent = await sendAccessLink({
    kind: "connexion",
    email,
    firstName: (profile as { first_name: string | null } | null)?.first_name ?? null,
    workspaceName: null,
    destination,
    siteUrl: await siteOrigin(),
  });

  if (sent.ok && sent.sent) return { ok: true, fallback: false };
  console.error(`[connexion] lien non envoyé : ${sent.ok ? sent.reason : sent.error}`);
  return { ok: true, fallback: true };
}
