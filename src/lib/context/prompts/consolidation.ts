/**
 * Prompt de consolidation : construit le brief éditorial à partir des résumés
 * des documents. Les clés du JSON attendu restent en français, ce sont elles
 * que le diff présente et que `parseProposal` traduit vers les colonnes.
 */
export const CONSOLIDATION_PROMPT = `Tu construis le brief éditorial d'un client à partir des résumés de ses documents de référence.

Ce brief sera injecté dans tous les prompts de génération de contenu du dashboard. Il doit être dense, factuel et directement actionnable. Pas de remplissage.

Règles :
1. Ne jamais inventer. Si une information n'est présente dans aucun document, laisse le champ vide plutôt que de le combler.
2. Privilégier les mots exacts de la marque et du client sur toute reformulation d'agence.
3. Les interdits sont contraignants : reporte-les tels quels, sans les adoucir.
4. Les piliers de contenu sont le champ le plus important. Chacun doit être suffisamment détaillé pour qu'un rédacteur puisse produire un post sans autre information : nom, description, objectif business, appels à l'action autorisés, angles concrets, formats adaptés, fréquence.
5. \`objectif_business\` dit ce que le pilier doit produire pour la marque. \`cta_autorises\` est une liste **fermée** : n'y mets que des appels à l'action que les documents autorisent, et laisse la liste vide s'ils n'en nomment aucun.
6. Les mentions obligatoires ne sont plus un champ à part : écris-les dans la règle du ou des réseaux concernés.

RÉSUMÉS DES DOCUMENTS :
{{resumes}}

BRIEF ACTUEL, SI EXISTANT (à enrichir sans écraser les modifications manuelles pertinentes) :
{{brief_actuel}}

Réponds uniquement par un objet JSON, sans préambule, sans balises markdown :
{
  "contexte_principal": "",
  "cibles": "",
  "tone_of_voice": "",
  "piliers": [ { "nom": "", "description": "", "objectif_business": "", "cta_autorises": [], "formats": [], "angles": [], "frequence": "" } ],
  "interdits": "",
  "plateformes": { "instagram": "", "linkedin": "", "tiktok": "", "facebook": "" }
}`;

/** Remplace les gabarits du prompt par les vraies valeurs. */
export function buildConsolidationPrompt(input: {
  resumes: string;
  briefActuel: string;
}): string {
  return CONSOLIDATION_PROMPT.replace("{{resumes}}", input.resumes || "(aucun document coché)")
    .replace("{{brief_actuel}}", input.briefActuel || "(aucun brief existant)");
}
