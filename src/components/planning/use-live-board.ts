"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/** Une rafale de changements (un mois généré, vingt lignes cochées) ne
    relit l'écran qu'une fois. */
const SETTLE_MS = 400;

/**
 * Le tableau se relit tout seul quand sa base change.
 *
 * Un wording écrit par Claude via le connecteur MCP, un sujet ajouté depuis un
 * autre poste, un statut posé par le client : sans ça, il fallait recharger la
 * page pour le voir. Realtime de Supabase (publication 20261007b) prévient
 * l'écran, qui relit ses données serveur — la même lecture qu'au chargement,
 * donc la même RLS : on ne reçoit que ce qu'on peut déjà lire.
 *
 * `router.refresh()` garde l'état du navigateur : une cellule en cours de
 * saisie garde son texte (`useCommittedValue`), un panneau ouvert reste ouvert.
 * Un onglet en arrière-plan ne relit qu'au retour, une fois.
 */
export function useLiveBoard(boardId: string, workspaceId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingWhileHidden = false;
    let cancelled = false;

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        pendingWhileHidden = true;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), SETTLE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && pendingWhileHidden) {
        pendingWhileHidden = false;
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase.channel(`planning:${boardId}`);
    for (const table of ["planning_subjects", "planning_lanes", "planning_months"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `board_id=eq.${boardId}` },
        refresh,
      );
    }
    // Les retours ne portent pas le tableau : filtrés par espace.
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "planning_comments", filter: `workspace_id=eq.${workspaceId}` },
      refresh,
    );

    // Le jeton de la session d'abord : sans lui, Realtime lit en anonyme et
    // la RLS ne laisse passer aucun changement.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [boardId, workspaceId, router]);
}
