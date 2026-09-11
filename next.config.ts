import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* « Échéances » est devenue « Factures » le 03/09/2026, l'écran ne se
     contentant plus d'afficher un calendrier : il émet et il relance. Le
     lien reste valable — un signet, un mail, un onglet ouvert depuis des
     semaines n'ont pas à tomber sur un 404. */
  async redirects() {
    return [
      {
        source: "/entreprise/echeances",
        destination: "/entreprise/factures",
        permanent: true,
      },
      /* « Modération » est devenue « Inbox » le 11/09/2026 : ce qu'on ouvre
         le matin est une boîte de réception, pas un poste de police. Les
         anciens liens — signets, messages partagés, `?client=` compris —
         restent valables. Le joker couvre `/moderation/<client>` et sa FAQ,
         qui redirigent à leur tour. */
      {
        source: "/moderation",
        destination: "/inbox",
        permanent: true,
      },
      {
        source: "/moderation/:path*",
        destination: "/inbox/:path*",
        permanent: true,
      },
    ];
  },
  // Les prompts de génération sont des fichiers markdown lus au runtime
  // (`src/lib/production/prompts.ts`) : sans cette déclaration, le tracing de
  // Vercel ne les embarquerait pas et les routes échoueraient en production.
  outputFileTracingIncludes: {
    "/api/generate/[phase]": ["./src/lib/prompts/**"],
    "/api/jobs/[id]/run": ["./src/lib/prompts/**"],
  },
  // Les 61 fichiers qui écrivent `import { Icon } from "lucide-react"` passent
  // par le baril du paquet, qui référence plus de mille icônes. Sans cette
  // liste, chacune de ces importations force l'outil de build à traverser tout
  // le baril — et en développement, à le recompiler. Recharts est là pour la
  // même raison, en plus de son chargement différé côté navigateur.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    // Le proxy (src/proxy.ts) tamponne le corps des requêtes qu'il
    // intercepte et **tronque à 10 Mo par défaut** : l'action recevait un
    // formulaire coupé (« Unexpected end of form », 500) dès qu'une vidéo
    // dépassait 10 Mo. Les visuels partent désormais du navigateur droit
    // vers Supabase Storage, mais le plafond reste levé pour tout envoi qui
    // passerait encore par ici.
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      // Aligné sur le plafond des fonctions Vercel. La limite par défaut
      // (1 Mo) refuserait la moindre créa passée par une action.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
