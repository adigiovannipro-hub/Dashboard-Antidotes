import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, LegalSection, LegalTerms } from "@/components/legal/legal-page";
import { HEBERGEURS, LEGAL_ENTITY, hasEuRepresentative, identityLines } from "@/lib/legal/entity";
import { pageMetadata } from "@/lib/seo";

/**
 * La politique de confidentialité — page **publique**, reprise telle quelle
 * de la plateforme Antidotes (c'est l'adresse déclarée chez Meta, TikTok,
 * LinkedIn et Google), complétée d'une section sur ce site : le lead
 * magnet, le questionnaire et la prise de rendez-vous.
 */
export const metadata: Metadata = pageMetadata("fr", "/confidentialite", {
  title: "Politique de confidentialité",
  description: "Comment Antidotes traite les données de ses utilisateurs, des comptes sociaux connectés et des visiteurs de ce site.",
});

export default function ConfidentialitePage() {
  const identite = identityLines();

  return (
    <LegalPage title="Politique de confidentialité" other={{ href: "/cgu", label: "Conditions générales d'utilisation →" }} home="/" updatedLabel="Dernière mise à jour :">
      <LegalSection title="Qui est responsable du traitement">
        <p>
          {LEGAL_ENTITY.nom} est responsable des traitements décrits ci-dessous. Directeur de la publication : {LEGAL_ENTITY.responsable}.
        </p>
        {identite.length > 0 ? <p>{identite.join(" · ")}</p> : null}
        <p>
          Pour toute question ou pour exercer vos droits : <LegalLink href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Ce site et le rendez-vous">
        <p>
          Le site antidotes.agency présente l&apos;activité de l&apos;agence et propose une note de gestion et de présence social media, remise en rendez-vous. Pour cela, il collecte, avec votre consentement explicite : votre prénom et votre adresse électronique, vos réponses au questionnaire, le fuseau horaire de votre navigateur, et, si vous prenez rendez-vous, votre nom, votre entreprise, votre téléphone si vous le donnez, et le créneau choisi.
        </p>
        <p>
          Ces données servent uniquement à calculer votre note, à organiser et confirmer votre rendez-vous (courriel de confirmation, rappel la veille, événement dans l&apos;agenda de l&apos;agence avec vous en invité), et à préparer l&apos;échange. Elles ne sont ni vendues, ni cédées, ni utilisées pour vous envoyer une lettre d&apos;information sans votre accord. Elles sont conservées trois ans après le dernier contact, puis effacées. Ce site ne dépose aucun cookie publicitaire ni de mesure d&apos;audience ; il garde seulement, le temps de votre visite, l&apos;avancement de votre questionnaire dans votre navigateur.
        </p>
      </LegalSection>

      <LegalSection title="Ce qu'est Antidotes">
        <p>
          Antidotes est un outil de travail interne à l&apos;agence, ouvert à ses clients sur la partie qui les concerne. Il rassemble le reporting des comptes sociaux, le planning éditorial, la modération des commentaires et messages, et la gestion administrative de l&apos;agence.
        </p>
        <p>Ce n&apos;est pas un service grand public : l&apos;accès se fait sur invitation nominative, et chaque client ne voit que son propre espace.</p>
      </LegalSection>

      <LegalSection title="Les données traitées">
        <p>Trois familles, qui ne se mélangent jamais.</p>
        <p>
          <strong className="text-text">Les comptes des personnes qui utilisent la plateforme.</strong> Adresse électronique, nom, rôle dans un espace, et le journal des actions effectuées (qui a modifié quoi, et quand). L&apos;adresse sert à l&apos;authentification par lien magique : aucun mot de passe n&apos;est conservé.
        </p>
        <p>
          <strong className="text-text">Les données des comptes sociaux connectés.</strong> Lorsqu&apos;un client autorise Antidotes à lire un compte, la plateforme collecte les statistiques de ce compte (impressions, portée, clics, réactions, abonnés), la liste de ses publications avec leur texte et leur vignette, et — pour les espaces qui utilisent la modération — les commentaires et messages privés reçus, avec le pseudonyme et l&apos;avatar de leur auteur.
        </p>
        <p>
          <strong className="text-text">Les données de gestion de l&apos;agence.</strong> Factures, transactions bancaires et pièces comptables. Elles ne concernent que l&apos;agence et ne sont accessibles à aucun client.
        </p>
      </LegalSection>

      <LegalSection title="Pourquoi, et sur quelle base">
        <LegalTerms
          items={[
            { term: "Consentement", text: "collecter votre adresse et vos réponses sur ce site, pour calculer votre note et organiser votre rendez-vous." },
            { term: "Exécution du contrat", text: "produire le reporting, planifier et publier les contenus, répondre aux commentaires et messages, facturer la prestation." },
            { term: "Intérêt légitime", text: "sécuriser l'accès et conserver un journal des actions, pour savoir qui a fait quoi sur un espace partagé." },
            { term: "Obligation légale", text: "conserver les pièces comptables pendant la durée prévue par la loi." },
          ]}
        />
        <p>Aucune donnée n&apos;est vendue, louée, ni cédée. Aucune n&apos;est utilisée pour du ciblage publicitaire, ni pour entraîner un modèle d&apos;intelligence artificielle.</p>
      </LegalSection>

      <LegalSection title="Les données venant de TikTok">
        <p>
          Lorsqu&apos;un compte TikTok est connecté, Antidotes demande trois autorisations et pas une de plus : <code className="type-caption rounded-sm bg-surface-2 px-1 py-0.5">user.info.basic</code>, <code className="type-caption rounded-sm bg-surface-2 px-1 py-0.5">user.info.stats</code> et <code className="type-caption rounded-sm bg-surface-2 px-1 py-0.5">video.list</code>.
        </p>
        <p>
          Elles servent uniquement à afficher, dans l&apos;espace du titulaire du compte, ses propres statistiques : nombre d&apos;abonnés, et vues, mentions « j&apos;aime », commentaires et partages de ses vidéos publiques. Ces données ne sont montrées à personne d&apos;autre qu&apos;à lui et à l&apos;équipe de l&apos;agence qui gère son compte.
        </p>
        <p>
          Antidotes ne lit aucun compte TikTok tiers, ne publie rien sans demande explicite, et n&apos;utilise ces données ni pour de la publicité, ni pour entraîner un modèle. Déconnecter le compte depuis la page Connexions efface le jeton d&apos;accès et les données collectées.
        </p>
      </LegalSection>

      <LegalSection title="Qui d'autre y a accès">
        <p>Antidotes s&apos;appuie sur des prestataires techniques, chacun pour un rôle précis :</p>
        <LegalTerms
          items={[
            ...HEBERGEURS.map((h) => ({ term: h.nom, text: `${h.role}.` })),
            { term: "Composio", text: "passerelle d'autorisation vers LinkedIn, TikTok, Google Analytics, et — pour ce site — vers la boîte Gmail et l'agenda Google de l'agence, qui envoient vos confirmations et créent votre rendez-vous." },
            { term: "Meta, Google, LinkedIn, TikTok", text: "les réseaux eux-mêmes, dont les interfaces de programmation fournissent les données de chaque compte connecté." },
            { term: "Anthropic", text: "rédaction de brouillons de réponse et lecture de pièces comptables. Les contenus transmis ne servent pas à entraîner de modèle." },
            { term: "Airwallex", text: "comptes bancaires et facturation de l'agence." },
            { term: "GitHub", text: "exécution des synchronisations planifiées." },
          ]}
        />
        <p>
          {LEGAL_ENTITY.nom} est établi à {LEGAL_ENTITY.juridiction}, et certains de ces prestataires le sont également hors de l&apos;Union européenne. Les transferts correspondants sont encadrés par les clauses contractuelles types de la Commission européenne.
        </p>
      </LegalSection>

      {hasEuRepresentative() ? (
        <LegalSection title="Représentant dans l'Union européenne">
          <p>
            Conformément à l&apos;article 27 du RGPD, {LEGAL_ENTITY.representantUE.nom} représente {LEGAL_ENTITY.nom} dans l&apos;Union européenne pour toute question relative au traitement des données. {LEGAL_ENTITY.representantUE.adresse}
            {LEGAL_ENTITY.representantUE.email ? ` — ${LEGAL_ENTITY.representantUE.email}` : ""}
          </p>
        </LegalSection>
      ) : null}

      <LegalSection title="Combien de temps">
        <LegalList
          items={[
            "Données de ce site (prénom, adresse, réponses, rendez-vous) : trois ans après le dernier contact.",
            "Comptes et journaux d'activité : tant que l'accès est ouvert, puis douze mois.",
            "Statistiques et publications des comptes sociaux : pendant toute la durée de la prestation — l'intérêt d'un historique est précisément sa longueur — puis effacées à la clôture de l'espace.",
            "Commentaires et messages : trois ans, la durée usuelle d'une relation commerciale.",
            "Jetons d'accès aux réseaux : chiffrés, et supprimés dès la déconnexion du compte.",
            "Pièces comptables : dix ans, comme l'impose la loi.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Les échanges sont chiffrés de bout en bout. Les jetons d&apos;accès aux réseaux sociaux sont chiffrés en base et ne sont jamais transmis au navigateur. Le cloisonnement entre espaces clients est appliqué par la base de données elle-même, et non par la seule interface — chaque module est accompagné de tests qui vérifient qu&apos;un client ne peut ni lire ni modifier l&apos;espace d&apos;un autre. Les données de ce site sont tenues dans une base distincte, qu&apos;aucune interface publique ne peut lire.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Antidotes ne dépose aucun cookie publicitaire ni aucun outil de mesure d&apos;audience. Sur la plateforme, seuls sont utilisés le cookie de session, qui maintient la connexion, et quelques cookies de préférence d&apos;affichage. Sur ce site, aucun cookie n&apos;est déposé.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité sur les données qui vous concernent, et vous pouvez retirer votre consentement à tout moment. Écrivez à <LegalLink href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</LegalLink> : la réponse intervient sous un mois. En cas de désaccord, vous pouvez saisir l&apos;autorité de protection des données de votre pays de résidence — en France, la CNIL.
        </p>
      </LegalSection>

      <LegalSection title="Modifications">
        <p>Cette politique peut évoluer avec la plateforme. La date de dernière mise à jour, en tête de page, fait foi ; un changement substantiel est annoncé aux personnes concernées.</p>
      </LegalSection>
    </LegalPage>
  );
}
