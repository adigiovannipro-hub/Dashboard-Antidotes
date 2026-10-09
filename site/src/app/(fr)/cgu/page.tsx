import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { CGU_MAJ, HEBERGEURS, LEGAL_ENTITY, identityLines } from "@/lib/legal/entity";
import { pageMetadata } from "@/lib/seo";

/** Les conditions générales d'utilisation — reprises telles quelles de la plateforme ; elles valent aussi mentions légales. */
export const metadata: Metadata = pageMetadata("fr", "/cgu", {
  title: "Conditions générales d'utilisation",
  description: "Les règles d'accès et d'usage de la plateforme Antidotes, et ses mentions légales.",
});

export default function CguPage() {
  const identite = identityLines();

  return (
    <LegalPage title="Conditions générales d'utilisation" other={{ href: "/confidentialite", label: "Politique de confidentialité →" }} home="/" updatedLabel="Dernière mise à jour :" updated={CGU_MAJ}>
      <LegalSection title="Éditeur">
        <p>
          Directeur de la publication : {LEGAL_ENTITY.responsable}. Contact : <LegalLink href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</LegalLink>.
        </p>
        {identite.length > 0 ? <p>{identite.join(" · ")}</p> : null}
        <p>Hébergement : {HEBERGEURS.map((h) => h.nom).join(", ")}</p>
      </LegalSection>

      <LegalSection title="Objet">
        <p>
          Antidotes est un outil professionnel de pilotage social media. Il réunit le reporting des comptes connectés, le planning éditorial, la modération des commentaires et messages, et la gestion administrative de l&apos;agence. Le site antidotes.agency en présente l&apos;activité et permet de prendre rendez-vous.
        </p>
        <p>L&apos;accès à la plateforme est réservé aux membres de l&apos;agence et aux clients invités nominativement. Il n&apos;y a pas d&apos;inscription libre.</p>
      </LegalSection>

      <LegalSection title="Accès et comptes">
        <p>
          L&apos;accès se fait par un lien d&apos;authentification envoyé à l&apos;adresse électronique invitée. Ce lien est personnel : il ne se partage pas. Chaque utilisateur répond des actions effectuées depuis son compte et prévient l&apos;éditeur dès qu&apos;il soupçonne un accès qui n&apos;est pas le sien.
        </p>
        <p>Un client accède à son seul espace, et aux seules pages qui lui ont été ouvertes.</p>
      </LegalSection>

      <LegalSection title="Comptes sociaux connectés">
        <p>
          Connecter un compte social suppose d&apos;en être titulaire ou d&apos;y être habilité. L&apos;autorisation est donnée par le réseau lui-même, se limite aux permissions affichées au moment de la connexion, et se retire à tout moment — depuis la page Connexions d&apos;Antidotes ou depuis le réseau.
        </p>
        <p>Antidotes lit ces comptes et, lorsque cela lui est demandé, publie ou répond en leur nom. Il n&apos;agit sur aucun compte tiers.</p>
        <p>
          {"TikTok. Connecter un compte TikTok vaut acceptation des Conditions d'utilisation de TikTok pour les développeurs et des Règles de la communauté TikTok. Avant chaque publication, l'utilisateur choisit la visibilité de la vidéo, autorise ou non les commentaires, duos et collages, déclare un éventuel contenu commercial et confirme l'utilisation de la musique. Antidotes ne publie jamais sur TikTok sans cette action explicite."}
        </p>
      </LegalSection>

      <LegalSection title="Usage attendu">
        <LegalList
          items={[
            "Ne pas tenter d'accéder à un espace ou à des données qui ne vous sont pas destinés.",
            "Ne pas publier, par l'intermédiaire de la plateforme, de contenu illicite ou contraire aux règles du réseau visé.",
            "Ne pas perturber le fonctionnement du service, ni en extraire massivement les données.",
            "Ne pas publier sur TikTok de contenu qui enfreint les règles de la communauté TikTok ou les obligations de déclaration des contenus commerciaux.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Disponibilité">
        <p>
          La plateforme est fournie en l&apos;état, sans garantie de disponibilité continue. Elle dépend d&apos;interfaces de programmation tierces — celles des réseaux sociaux et des services bancaires — dont l&apos;interruption, la limitation ou la modification échappe à l&apos;éditeur. Une donnée absente est signalée comme telle et n&apos;est jamais remplacée par une estimation.
        </p>
      </LegalSection>

      <LegalSection title="Propriété">
        <p>
          Le code, l&apos;interface et le nom Antidotes appartiennent à l&apos;éditeur. Les contenus déposés par un client — visuels, textes, documents — restent sa propriété ; il concède à l&apos;éditeur le droit de les héberger et de les traiter aux seules fins de la prestation.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          L&apos;éditeur répond de la conformité du service à ce qui est décrit ici. Il ne répond ni des décisions prises au vu des chiffres affichés, ni des conséquences d&apos;une publication validée par le client, ni d&apos;une défaillance d&apos;un service tiers.
        </p>
      </LegalSection>

      <LegalSection title="Fin d'accès">
        <p>
          L&apos;accès prend fin avec la prestation, ou sur demande. À la clôture d&apos;un espace, ses données sont supprimées dans les conditions décrites par la politique de confidentialité ; les pièces comptables sont conservées le temps que la loi impose.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>Ces conditions sont soumises au droit {LEGAL_ENTITY.droitApplicable}. À défaut d&apos;accord amiable, le litige relève des tribunaux compétents.</p>
      </LegalSection>
    </LegalPage>
  );
}
