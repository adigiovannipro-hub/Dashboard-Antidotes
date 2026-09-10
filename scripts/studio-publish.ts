/**
 * Les posts LinkedIn programmés — depuis une machine GitHub.
 *
 *   pnpm studio:publier
 *
 * Un brouillon approuvé et daté part à son heure : le passage horaire prend
 * ce qui est dû (`dueDrafts`, pur et testé), publie par le même chemin que
 * le bouton de l'écran (`publishToLinkedin`), et écrit le résultat sur la
 * ligne — URL et date en succès, message d'erreur visible en échec.
 *
 * Le statut est **relu juste avant l'envoi** : entre la sélection et
 * l'appel, quelqu'un a pu publier depuis l'écran ou remettre en brouillon.
 * Rien ne part deux fois.
 *
 * `server-only` est neutralisé par la condition `react-server` de Node.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { dueDrafts } = await import("../src/lib/antidotes/inbound/due-drafts");
  const { publishToLinkedin, publishAvailability } = await import("../src/lib/antidotes/inbound/linkedin-publish");
  const { readVisual } = await import("../src/lib/antidotes/inbound/visual");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("antidotes_generated_posts")
    .select("id, org_id, format, status, scheduled_at, content, image_url")
    .eq("status", "approved")
    .eq("format", "linkedin_post")
    .not("scheduled_at", "is", null)
    .limit(200);
  if (error) {
    console.error(`Lecture des brouillons : ${error.message}`);
    process.exit(1);
  }

  type Row = {
    id: string;
    org_id: string;
    format: "linkedin_post" | "reel_script";
    status: "draft" | "approved" | "published" | "rejected";
    scheduled_at: string | null;
    content: string;
    image_url: string | null;
  };
  const due = dueDrafts((data ?? []) as unknown as Row[], new Date());
  if (due.length === 0) {
    console.log("Aucun post programmé n'est dû.");
    return;
  }

  const unavailable = publishAvailability();
  if (unavailable) {
    console.error(`${due.length} post(s) dû(s), mais la publication est indisponible : ${unavailable}`);
    process.exit(1);
  }

  let published = 0;
  let failures = 0;
  for (const draft of due as (Row & { id: string })[]) {
    // Relecture juste avant l'envoi : l'écran a pu bouger depuis la sélection.
    const { data: fresh } = await admin
      .from("antidotes_generated_posts")
      .select("status")
      .eq("id", draft.id)
      .maybeSingle();
    if ((fresh as { status?: string } | null)?.status !== "approved") {
      console.log(`→ ${draft.id} ignoré : plus approuvé.`);
      continue;
    }

    try {
      const image = draft.image_url ? await readVisual(admin, draft.image_url) : null;
      const result = await publishToLinkedin({ text: draft.content, image });
      await admin
        .from("antidotes_generated_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          linkedin_post_id: result.postUrn,
          published_url: result.url,
          error: null,
        } as never)
        .eq("id", draft.id);
      published += 1;
      console.log(`✓ ${draft.id} → ${result.url}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await admin.from("antidotes_generated_posts").update({ error: message } as never).eq("id", draft.id);
      failures += 1;
      console.log(`⚠ ${draft.id} — ${message}`);
    }
  }

  console.log(`Publiés ${published} · échecs ${failures} sur ${due.length} dû(s).`);
  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
