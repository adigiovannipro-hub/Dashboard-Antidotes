/**
 * Les posts LinkedIn programmés — depuis une machine GitHub, en portée
 * `studio` seulement — ni sur un schedule, ni dans `tout`.
 *
 *   pnpm studio:publier
 *
 * Un brouillon approuvé et daté part à son heure : le passage prend ce qui
 * est dû (`dueDrafts`, pur et testé), publie par le même chemin que le
 * bouton de l'écran (`publishToLinkedin`), et écrit le résultat sur la
 * ligne — URL et date en succès, message d'erreur visible en échec.
 *
 * Le statut est **relu juste avant l'envoi** : entre la sélection et
 * l'appel, quelqu'un a pu publier depuis l'écran ou remettre en brouillon.
 * Rien ne part deux fois.
 *
 * Trois sorties par brouillon, et elles ne se confondent pas :
 *   ✓ publié ;
 *   ✗ refusé par le réseau — LinkedIn ou Composio a dit non (jeton révoqué,
 *     compte débranché, plafond). C'est un état de la connexion, écrit sur le
 *     brouillon en français avec le geste à faire, et le passage reste vert :
 *     un jeton révoqué sur un brouillon de démo mettait le workflow entier en
 *     rouge, cinq passages sur dix, jusqu'à ce qu'on cesse de le lire ;
 *   ⚠ erreur du passage — de notre côté (visuel illisible, écriture refusée).
 * Le passage ne sort en rouge que si rien n'a pu être traité et que la cause
 * est la nôtre : variable ou clé absente, base injoignable.
 *
 * `server-only` est neutralisé par la condition `react-server` de Node.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

/** Un message d'erreur qui tienne sur une ligne de journal et dans une cellule. */
const MESSAGE_MAX = 400;

function describe(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const compact = raw.replace(/\s+/g, " ").trim();
  return compact.length > MESSAGE_MAX ? `${compact.slice(0, MESSAGE_MAX)}…` : compact;
}

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
  const { explainLinkedinError } = await import("../src/lib/connectors/linkedin/errors");

  /* Le refus du réseau, traduit en geste : « 401 REVOKED_ACCESS_TOKEN » se
     lit « rebrancher le compte LinkedIn chez Composio ». Le brut reste entre
     parenthèses, coupé s'il déborde — la traduction guide, l'original
     prouve, et un JSON entier ne prouve rien de plus. */
  const describeRefusal = (cause: unknown): string => {
    const raw = (cause instanceof Error ? cause.message : String(cause)).replace(/\s+/g, " ").trim();
    const explained = explainLinkedinError(raw);
    return explained.length > MESSAGE_MAX ? `${explained.slice(0, MESSAGE_MAX)}…` : explained;
  };

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

  /* L'erreur s'écrit sur le brouillon : c'est là que l'écran la montre. Une
     écriture refusée se dit, elle ne fait pas tomber le brouillon suivant. */
  const noteError = async (id: string, message: string): Promise<void> => {
    const { error: writeError } = await admin
      .from("antidotes_generated_posts")
      .update({ error: message } as never)
      .eq("id", id);
    if (writeError) console.log(`    (erreur non écrite sur le brouillon : ${writeError.message})`);
  };

  const counts = { published: 0, refused: 0, failed: 0, skipped: 0 };
  for (const draft of due) {
    // Relecture juste avant l'envoi : l'écran a pu bouger depuis la sélection.
    const { data: fresh, error: freshError } = await admin
      .from("antidotes_generated_posts")
      .select("status")
      .eq("id", draft.id)
      .maybeSingle();
    if (freshError) {
      counts.failed += 1;
      console.log(`⚠ ${draft.id} erreur du passage — relecture du statut : ${freshError.message}`);
      continue;
    }
    if ((fresh as { status?: string } | null)?.status !== "approved") {
      counts.skipped += 1;
      console.log(`→ ${draft.id} ignoré : plus approuvé.`);
      continue;
    }

    // 1. Le visuel vient de notre bucket : un échec ici n'a rien de LinkedIn.
    let image: Buffer | null = null;
    try {
      image = draft.image_url ? await readVisual(admin, draft.image_url) : null;
    } catch (cause) {
      const message = describe(cause);
      counts.failed += 1;
      console.log(`⚠ ${draft.id} erreur du passage — ${message}`);
      await noteError(draft.id, message);
      continue;
    }

    // 2. Le réseau : tout ce que LinkedIn ou Composio refuse est un état de
    //    la connexion, pas du passage.
    let result: { postUrn: string; url: string };
    try {
      result = await publishToLinkedin({ text: draft.content, image });
    } catch (cause) {
      const message = describeRefusal(cause);
      counts.refused += 1;
      console.log(`✗ ${draft.id} refusé par LinkedIn — ${message}`);
      await noteError(draft.id, message);
      continue;
    }

    // 3. La preuve en base. Publié chez LinkedIn mais pas écrit ici, le
    //    brouillon repartirait au prochain passage : ça se dit fort.
    const { error: writeError } = await admin
      .from("antidotes_generated_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        linkedin_post_id: result.postUrn,
        published_url: result.url,
        error: null,
      } as never)
      .eq("id", draft.id);
    if (writeError) {
      counts.failed += 1;
      console.log(
        `⚠ ${draft.id} erreur du passage — publié (${result.url}) mais non enregistré : ${writeError.message}. Le passer en « publié » à la main, sinon il repartira.`,
      );
      continue;
    }
    counts.published += 1;
    console.log(`✓ ${draft.id} → ${result.url}`);
  }

  console.log(
    `Publiés ${counts.published} · refusés par le réseau ${counts.refused} · erreurs du passage ${counts.failed} · ignorés ${counts.skipped} sur ${due.length} dû(s).`,
  );

  /* Un refus du réseau est écrit sur le brouillon et lisible à l'écran : le
     passage a fait son travail. Il n'échoue que si rien n'a pu être traité
     et que la cause est de notre côté. */
  const treated = counts.published + counts.refused + counts.skipped;
  if (treated === 0 && counts.failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
