/** Prompt d'extraction : export d'un site web de marque. */
export const WEBSITE_PROMPT = `Tu analyses l'export d'un site web de marque pour en extraire ce qui est utile à la production de contenu social media.

Ignore les mentions légales, CGV, politiques de confidentialité, formulaires, éléments de navigation et textes techniques.

Extrais et restitue en 5 à 8 lignes maximum :
- Ce que vend la marque, gamme de prix, nombre de références
- Les arguments de vente qui reviennent le plus souvent, dans les mots exacts de la marque
- Le registre de langue employé (niveau de familiarité, jargon, longueur des phrases)
- Les éléments de storytelling récurrents : origine, fabrication, fondateurs, engagement
- Tout vocabulaire propriétaire ou tournure signature repérable

Ne juge pas, ne recommande rien. Tu décris ce qui existe.
Aucun tiret long. Pas d'emoji. Pas de préambule.`;
