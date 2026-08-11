/** Prompt d'extraction : questionnaire d'onboarding rempli par le client. */
export const QUESTIONNAIRE_PROMPT = `Tu analyses le questionnaire d'onboarding rempli par un client d'une agence social media.

Extrais et restitue en 5 à 8 lignes maximum :
- Les objectifs déclarés, dans leur ordre de priorité
- Les cibles décrites, avec les mots du client
- Les contraintes et interdits explicites : ce qu'il refuse de voir publié, ce qui a déjà échoué
- Les concurrents cités et ce que le client leur reproche ou leur envie
- Les préférences de ton, de format ou de fréquence exprimées

Distingue nettement ce que le client affirme de ce qu'il souhaite. Ne reformule pas ses interdits en recommandations souples : ils sont contraignants.
Aucun tiret long. Pas d'emoji. Pas de préambule.`;
