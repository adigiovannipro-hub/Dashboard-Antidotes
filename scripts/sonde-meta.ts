/**
 * Sonde la Graph API de Meta **en direct**, sur les comptes d'un espace.
 *
 *   pnpm sonde:meta --espace i-way
 *   pnpm sonde:meta --espace i-way --version v23.0
 *   pnpm sonde:meta --espace bondet --messagerie
 *
 * Sans `--messagerie`, elle répond à une seule question, et sur pièce :
 * **quels noms de métriques Meta sert encore**. Fin 2025, `post_impressions`,
 * `post_impressions_unique` et `post_video_views` ont été dépréciées au
 * profit de `views` sur les publications de Page, et `page_impressions` au
 * profit de `page_media_view` au grain jour — mais la date d'entrée en
 * vigueur dépend de la version de Graph, et une relecture de la
 * documentation ne tranche pas. Un refus rendu par l'API, si.
 *
 * Avec `--messagerie`, elle sonde **la boîte des Pages à la place des
 * métriques** : `/{page}/conversations` sur Messenger et sur Instagram, tel
 * que le relevé de l'Inbox le demande — et tel que Meta le refuse à
 * certaines Pages (Bondet, I-WAY) sans dire si c'est le volume ou la portée.
 * Un compte Instagram se sonde par sa Page parente, la messagerie d'un compte
 * professionnel passant par elle. Chaque appel est borné à 45 s et **jamais
 * rejoué** ; le statut, le corps brut et la durée en millisecondes sont
 * affichés, c'est tout ce qu'il faut pour trancher. `/me/permissions` dit ce
 * que le jeton porte vraiment — on y cherche `pages_messaging` et
 * `instagram_manage_messages` — et `/debug_token` le redit avec les portées
 * granulaires quand `META_APP_ID` et `META_APP_SECRET` sont dans
 * l'environnement.
 *
 * Tout est affiché **brut** : le corps de la réponse, ou le corps de l'erreur.
 * C'est la règle de la maison — la forme d'une réponse ne se relit pas, elle
 * se sonde. Aucun de nos parseurs n'intervient, et `graph.ts` n'est pas
 * importé : ses reprises et son escalier de repli sont justement ce qu'on
 * veut voir sans.
 *
 * Lecture seule : pas une écriture en base, pas un appel qui modifie quoi que
 * ce soit chez Meta. À jouer depuis l'étape « Sonde Meta » du workflow
 * « Base de données ».
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
] as const;

function argValue(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Les métriques d'une publication de Page, demandées **une par une**. */
const POST_METRICS = [
  "views",
  "post_impressions",
  "post_impressions_unique",
  "post_video_views",
];

/** Les métriques de la Page au grain jour, l'ancien nom à côté du nouveau. */
const PAGE_METRICS = [
  "page_media_view",
  "page_impressions",
  "page_views_total",
  "page_post_engagements",
  "page_video_views",
  "page_follows",
];

/** Les métriques d'un média Instagram — la bascule y est déjà faite. */
const MEDIA_METRICS = ["views", "reach", "total_interactions"];

/**
 * Le même délai que `fetchGraph` : c'est au-delà qu'un « long polling
 * terminated due to timeout » arrive, et c'est ce délai, rejoué deux fois
 * par palier, qui coûtait 700 s par Page refusée.
 */
const SONDE_TIMEOUT_MS = 45_000;

/** Ce qui ne s'affiche jamais : un jeton de Page publie, un secret d'app signe. */
const SECRET_PARAMS = ["access_token", "input_token"];

type Sonde = (path: string, params: Record<string, string>) => Promise<void>;

/**
 * Un appel, un seul — jamais rejoué, borné à 45 s — et son corps affiché
 * tel quel, avec la durée. Un timeout se dit comme tel : c'est la réponse
 * qu'on cherche quand on soupçonne le volume plutôt que le refus.
 *
 * Les jetons sont retirés de l'URL affichée : la sortie d'un runner GitHub
 * est lisible par qui a accès au dépôt.
 */
function makeSonde(base: string, accessToken: string): Sonde {
  return async (path, params) => {
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (!url.searchParams.has("access_token")) {
      url.searchParams.set("access_token", accessToken);
    }
    const affichee = new URL(url);
    for (const name of SECRET_PARAMS) affichee.searchParams.delete(name);
    console.log(`\n→ ${affichee.pathname}${affichee.search}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SONDE_TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.text();
      console.log(`  ${response.status} · ${Date.now() - startedAt} ms · ${body}`);
    } catch (error) {
      const ms = Date.now() - startedAt;
      if ((error as { name?: string } | null)?.name === "AbortError") {
        console.log(`  timeout après ${SONDE_TIMEOUT_MS / 1000} s · ${ms} ms`);
      } else {
        const detail =
          error instanceof Error ? `${error.name} ${error.message}` : String(error);
        console.log(`  erreur · ${ms} ms · ${detail}`);
      }
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * La boîte d'une Page, en cinq lectures. Les trois premières sont celles du
 * relevé, réduites au minimum : un fil Messenger, un fil Instagram, cinq
 * identifiants Instagram sans `since` ni participants — si celle-là tombe en
 * timeout, ce n'est pas le volume. Puis le rattachement IG ↔ Page, et les
 * portées que le jeton porte vraiment. La sonde n'interprète pas : elle
 * montre.
 */
async function sondeMessagerie(
  sonde: Sonde,
  pageId: string,
  accessToken: string,
): Promise<void> {
  await sonde(`/${pageId}/conversations`, {
    platform: "messenger",
    limit: "1",
    fields: "id,updated_time",
  });
  await sonde(`/${pageId}/conversations`, {
    platform: "instagram",
    limit: "1",
    fields: "id,updated_time",
  });
  await sonde(`/${pageId}/conversations`, {
    platform: "instagram",
    limit: "5",
    fields: "id",
  });
  await sonde(`/${pageId}`, { fields: "instagram_business_account,name" });
  await sonde("/me/permissions", {});

  /* `/me/permissions` ne répond que sur un jeton d'utilisateur ; sur un jeton
     de Page — ce que le branchement range pour les Pages et les comptes
     Instagram — c'est `/debug_token` qui rend les portées, mais il demande
     le jeton d'app. Facultatif : la sonde le dit plutôt que de le taire. */
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (appId && appSecret) {
    await sonde("/debug_token", {
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    });
  } else {
    console.log(
      "\n→ /debug_token\n  (non sondé : META_APP_ID et META_APP_SECRET absents de l'environnement)",
    );
  }
}

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const label = argValue("espace");
  if (!label) {
    console.error(
      "Usage : pnpm sonde:meta --espace <slug> [--version v23.0] [--messagerie]",
    );
    process.exit(1);
  }
  const messagerie = hasFlag("messagerie");

  /* `||` et non `??` : le workflow passe la variable vide quand le champ
     n'est pas rempli, et une chaîne vide fabriquerait une URL sans version. */
  const version =
    argValue("version") || process.env.META_GRAPH_VERSION || "v21.0";
  const base = `https://graph.facebook.com/${version}`;

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { decryptSecret } = await import("../src/lib/moderation/crypto");
  const { findWorkspaceByLabel } = await import("../src/lib/workspaces/lookup");

  const admin = createAdminClient();

  const { data: workspaces, error: workspacesError } = await admin
    .from("workspaces")
    .select("id, slug, name");
  if (workspacesError) {
    console.error(`Lecture des espaces : ${workspacesError.message}`);
    process.exit(1);
  }

  const known = (workspaces ?? []) as unknown as {
    id: string;
    slug: string;
    name: string;
  }[];
  const workspace = findWorkspaceByLabel(label, known);
  if (!workspace) {
    // Un espace introuvable ne se contente pas d'un avertissement : la sonde
    // n'aurait rien à dire, et un passage vert aurait l'air d'une réponse.
    console.error(
      `Espace « ${label} » introuvable. Connus : ${known
        .map((w) => w.slug)
        .join(", ")}.`,
    );
    process.exit(1);
  }

  console.log(
    `Graph ${version} — espace ${workspace.slug} (${workspace.name})${messagerie ? " — messagerie" : ""}`,
  );

  const { data: links, error: linksError } = await admin
    .from("workspace_social_accounts")
    .select("kind, account_id")
    .eq("workspace_id", workspace.id)
    .in("kind", ["instagram", "facebook_page"]);
  if (linksError) {
    console.error(`Lecture des affectations : ${linksError.message}`);
    process.exit(1);
  }

  const affectes = (links ?? []) as unknown as {
    kind: "instagram" | "facebook_page";
    account_id: string;
  }[];
  if (affectes.length === 0) {
    console.error(
      "Aucun compte Instagram ni Page affecté à cet espace — rien à sonder.",
    );
    process.exit(1);
  }

  for (const link of affectes) {
    const { data: account } = await admin
      .from("social_accounts")
      .select("external_id, display_name, parent_external_id")
      .eq("id", link.account_id)
      .single();
    const compte = account as unknown as {
      external_id: string;
      display_name: string | null;
      parent_external_id: string | null;
    } | null;
    if (!compte) {
      console.error(`\n${link.kind} : compte ${link.account_id} introuvable.`);
      continue;
    }

    const { data: secret } = await admin
      .from("social_account_secrets")
      .select("credentials_encrypted")
      .eq("account_id", link.account_id)
      .maybeSingle();
    const blob = (secret as { credentials_encrypted?: string } | null)
      ?.credentials_encrypted;
    if (!blob) {
      console.error(
        `\n${link.kind} : aucun jeton enregistré — rebrancher Meta depuis Connexions.`,
      );
      continue;
    }

    console.log(
      `\n=== ${link.kind} · ${compte.display_name ?? compte.external_id} · ${compte.external_id} ===`,
    );

    let accessToken = decryptSecret(blob);

    if (link.kind === "facebook_page") {
      /* La « nouvelle expérience Pages » refuse les insights à un jeton
         d'utilisateur. L'échange est gratuit et idempotent ; on garde le
         jeton d'origine s'il échoue, pour que la sonde dise quand même ce
         que Meta répond. */
      const echange = await fetch(
        `${base}/${compte.external_id}?fields=access_token&access_token=${encodeURIComponent(accessToken)}`,
      );
      const payload = (await echange.json()) as { access_token?: string };
      if (payload.access_token) accessToken = payload.access_token;
      else console.log("  (jeton de Page non obtenu — sonde avec le jeton du branchement)");

      const sonde = makeSonde(base, accessToken);

      if (messagerie) {
        await sondeMessagerie(sonde, compte.external_id, accessToken);
        continue;
      }

      // Une publication récente sert de cobaye : c'est sur elle que se lit le
      // refus, pas sur la Page.
      const posts = await fetch(
        `${base}/${compte.external_id}/published_posts?limit=1&fields=id,created_time&access_token=${encodeURIComponent(accessToken)}`,
      );
      const postsBody = await posts.text();
      console.log(`\n→ /published_posts?limit=1\n  ${posts.status} ${postsBody}`);

      let postId: string | null = null;
      try {
        postId =
          (JSON.parse(postsBody) as { data?: { id?: string }[] }).data?.[0]?.id ??
          null;
      } catch {
        // Corps illisible : il est déjà affiché, on passe à la Page.
      }

      if (postId) {
        for (const metric of POST_METRICS) {
          await sonde(`/${postId}/insights`, { metric });
        }
      } else {
        console.log("  (aucune publication lue — pas de sonde par publication)");
      }

      // Trente jours : assez pour que la série existe, assez peu pour que la
      // réponse tienne à l'écran.
      const jour = 86_400_000;
      const until = Math.floor(Date.now() / 1000);
      const since = Math.floor((Date.now() - 30 * jour) / 1000);
      await sonde(`/${compte.external_id}/insights`, {
        metric: PAGE_METRICS.join(","),
        period: "day",
        since: String(since),
        until: String(until),
      });
      // Puis une par une : la liste entière tombe dès qu'un seul nom est
      // refusé, et c'est justement le nom fautif qu'on cherche.
      for (const metric of PAGE_METRICS) {
        await sonde(`/${compte.external_id}/insights`, {
          metric,
          period: "day",
          since: String(since),
          until: String(until),
        });
      }
      continue;
    }

    const sonde = makeSonde(base, accessToken);

    if (messagerie) {
      /* Comme le relevé : la boîte d'un compte Instagram est celle de sa
         Page, avec le jeton rangé sur le compte — un jeton de Page depuis le
         branchement. Sans Page parente, il n'y a rien à sonder, et le relevé
         le dit de la même façon. */
      if (!compte.parent_external_id) {
        console.log(
          "  (aucune Page rattachée à ce compte Instagram — la messagerie passe par elle, rien à sonder)",
        );
        continue;
      }
      console.log(`  Page parente : ${compte.parent_external_id}`);
      await sondeMessagerie(sonde, compte.parent_external_id, accessToken);
      continue;
    }

    const media = await fetch(
      `${base}/${compte.external_id}/media?limit=1&fields=id,timestamp,media_type&access_token=${encodeURIComponent(accessToken)}`,
    );
    const mediaBody = await media.text();
    console.log(`\n→ /media?limit=1\n  ${media.status} ${mediaBody}`);

    let mediaId: string | null = null;
    try {
      mediaId =
        (JSON.parse(mediaBody) as { data?: { id?: string }[] }).data?.[0]?.id ??
        null;
    } catch {
      // Corps illisible : déjà affiché.
    }

    if (!mediaId) {
      console.log("  (aucun média lu — pas de sonde d'insights)");
      continue;
    }
    await sonde(`/${mediaId}/insights`, { metric: MEDIA_METRICS.join(",") });
    for (const metric of MEDIA_METRICS) {
      await sonde(`/${mediaId}/insights`, { metric });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
