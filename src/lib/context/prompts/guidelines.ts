/** Prompt d'extraction : charte graphique ou éditoriale. */
export const GUIDELINES_PROMPT = `Tu analyses la charte graphique ou éditoriale d'une marque.

Extrais et restitue en 5 à 8 lignes maximum :
- Les couleurs, typographies et principes de composition imposés, avec leurs valeurs exactes quand elles sont données
- Les règles d'usage du logo et des visuels : marges, fonds autorisés, interdits
- Les règles d'écriture : ton imposé, tutoiement ou vouvoiement, vocabulaire obligatoire ou banni
- Les formats et gabarits prévus pour les réseaux sociaux, s'il y en a
- Tout interdit explicite de la charte, reporté tel quel

Reste fidèle au document. Ne complète pas ce qui manque, ne modernise rien.
Aucun tiret long. Pas d'emoji. Pas de préambule.`;
