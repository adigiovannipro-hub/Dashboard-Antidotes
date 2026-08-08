import "server-only";

import type { DataProvider } from "@/lib/supabase/database.types";

import type { Connector } from "./types";

/**
 * Les connecteurs se déclarent ici au fil de leur implémentation — Meta
 * d'abord (phase 2 du plan), puis LinkedIn, TikTok et GA4 à mesure que les
 * accès développeur sont accordés.
 *
 * Un provider absent n'est pas un bug : la synchronisation marque la source
 * en erreur avec un message actionnable, et l'écran d'admin sait dire
 * « connecteur à venir » au lieu de proposer une connexion qui ne peut pas
 * aboutir.
 */
const CONNECTORS: Partial<Record<DataProvider, Connector>> = {};

export function getConnector(provider: DataProvider): Connector | null {
  return CONNECTORS[provider] ?? null;
}
