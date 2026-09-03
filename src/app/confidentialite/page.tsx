import type { Metadata } from "next";

import {
  LegalList,
  LegalPage,
  LegalSection,
  LegalTerms,
} from "@/components/legal/legal-page";
import { HEBERGEURS, LEGAL_ENTITY, identityLines } from "@/lib/legal/entity";

/**
 * La politique de confidentialité — page **publique**.
 *
 * Elle existe d'abord parce que les plateformes l'exigent : TikTok, Meta et
 * Google refusent une application dont l'URL de confidentialité ne répond
 * pas. Mais son contenu décrit ce que la plateforme fait réellement, et rien
 * d'autre : une politique recopiée d'un modèle promettrait des traitements
 * qui n'existent pas ici, et tairait ceux qui existent.
 */

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment Antidotes traite les données de ses utilisateurs et des comptes sociaux connectés.",
};

export default function ConfidentialitePage() {
  const identite = identityLines();

  return (
    <LegalPage
      title="Politique de confidentialité"
      other={{ href: "/cgu", label: "Conditions générales d'utilisation →" }}
    >
      <LegalSection title="Qui est responsable du traitement">
        <p>
          {LEGAL_ENTITY.nom} est responsable des traitements décrits ci-dessous.
          Directeur de la publication : {LEGAL_ENTITY.responsable}.
        </p>
        {identite.length > 0 ? <p>{identite.join(" · ")}</p> : null}
        <p>
          Pour toute question ou pour exercer vos droits :{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.email}`}
            className="underline underline-offset-4 hover:text-text-primary"
          >
            {LEGAL_ENTITY.email}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Ce qu'est Antidotes">
        <p>
          Antidotes est un outil de travail interne à l&apos;agence, ouvert à ses
          clients sur la partie qui les concerne. Il rassemble le reporting des
          comptes sociaux, le planning éditorial, la modération des
          commentaires et messages, et la gestion administrative de l&apos;agence.
        </p>
        <p>
          Ce n&apos;est pas un service grand public : l&apos;accès se fait sur invitation
          nominative, et chaque client ne voit que son propre espace.
        </p>
      </LegalSection>

      <LegalSection title="Les données traitées">
        <p>Trois familles, qui ne se mélangent jamais.</p>
        <p>
          <strong className="text-text-primary">
            Les comptes des personnes qui utilisent la plateforme.
          </strong>{" "}
          Adresse électronique, nom, rôle dans un espace, et le journal des
          actions effectuées (qui a modifié quoi, et quand). L&apos;adresse sert à
          l&apos;authentification par lien magique : aucun mot de passe n&apos;est
          conservé.
        </p>
        <p>
          <strong className="text-text-primary">
            Les données des comptes sociaux connectés.
          </strong>{" "}
          Lorsqu&apos;un client autorise Antidotes à lire un compte, la plateforme
          collecte les statistiques de ce compte (impressions, portée, clics,
          réactions, abonnés), la liste de ses publications avec leur texte et
          leur vignette, et — pour les espaces qui utilisent la modération —
          les commentaires et messages privés reçus, avec le pseudonyme et
          l&apos;avatar de leur auteur.
        </p>
        <p>
          <strong className="text-text-primary">
            Les données de gestion de l&apos;agence.
          </strong>{" "}
          Factures, transactions bancaires et pièces comptables. Elles ne
          concernent que l&apos;agence et ne sont accessibles à aucun client.
        </p>
      </LegalSection>

      <LegalSection title="Pourquoi, et sur quelle base">
        <LegalTerms
          items={[
            {
              term: "Exécution du contrat",
              text: "produire le reporting, planifier et publier les contenus, répondre aux commentaires et messages, facturer la prestation.",
            },
            {
              term: "Intérêt légitime",
              text: "sécuriser l'accès et conserver un journal des actions, pour savoir qui a fait quoi sur un espace partagé.",
            },
            {
              term: "Obligation légale",
              text: "conserver les pièces comptables pendant la durée prévue par la loi.",
            },
          ]}
        />
        <p>
          Aucune donnée n&apos;est vendue, louée, ni cédée. Aucune n&apos;est utilisée
          pour du ciblage publicitaire, ni pour entraîner un modèle
          d&apos;intelligence artificielle.
        </p>
      </LegalSection>

      <LegalSection title="Les données venant de TikTok">
        <p>
          Lorsqu&apos;un compte TikTok est connecté, Antidotes demande trois
          autorisations et pas une de plus :{" "}
          <code className="type-caption rounded-sm bg-surface-sunken px-1 py-0.5">
            user.info.basic
          </code>
          ,{" "}
          <code className="type-caption rounded-sm bg-surface-sunken px-1 py-0.5">
            user.info.stats
          </code>{" "}
          et{" "}
          <code className="type-caption rounded-sm bg-surface-sunken px-1 py-0.5">
            video.list
          </code>
          .
        </p>
        <p>
          Elles servent uniquement à afficher, dans l&apos;espace du titulaire du
          compte, ses propres statistiques : nombre d&apos;abonnés, et vues,
          mentions « j&apos;aime », commentaires et partages de ses vidéos
          publiques. Ces données ne sont montrées à personne d&apos;autre qu&apos;à lui
          et à l&apos;équipe de l&apos;agence qui gère son compte.
        </p>
        <p>
          Antidotes ne lit aucun compte TikTok tiers, ne publie rien sans
          demande explicite, et n&apos;utilise ces données ni pour de la publicité,
          ni pour entraîner un modèle. Déconnecter le compte depuis la page
          Connexions efface le jeton d&apos;accès et les données collectées.
        </p>
      </LegalSection>

      <LegalSection title="Qui d'autre y a accès">
        <p>
          Antidotes s&apos;appuie sur des prestataires techniques, chacun pour un
          rôle précis :
        </p>
        <LegalTerms
          items={[
            ...HEBERGEURS.map((h) => ({ term: h.nom, text: `${h.role}.` })),
            {
              term: "Composio",
              text: "passerelle d'autorisation vers LinkedIn, TikTok et Google Analytics.",
            },
            {
              term: "Meta, Google, LinkedIn, TikTok",
              text: "les réseaux eux-mêmes, dont les interfaces de programmation fournissent les données de chaque compte connecté.",
            },
            {
              term: "Anthropic",
              text: "rédaction de brouillons de réponse et lecture de pièces comptables. Les contenus transmis ne servent pas à entraîner de modèle.",
            },
            {
              term: "Airwallex",
              text: "comptes bancaires et facturation de l'agence.",
            },
            {
              term: "GitHub",
              text: "exécution des synchronisations planifiées.",
            },
          ]}
        />

        <p>
          Certains de ces prestataires sont établis hors de l&apos;Union européenne.
          Les transferts correspondants sont encadrés par les clauses
          contractuelles types de la Commission européenne.
        </p>
      </LegalSection>

      <LegalSection title="Combien de temps">
        <LegalList
          items={[
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
          Les échanges sont chiffrés de bout en bout. Les jetons d&apos;accès aux
          réseaux sociaux sont chiffrés en base et ne sont jamais transmis au
          navigateur. Le cloisonnement entre espaces clients est appliqué par
          la base de données elle-même, et non par la seule interface — chaque
          module est accompagné de tests qui vérifient qu&apos;un client ne peut ni
          lire ni modifier l&apos;espace d&apos;un autre.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Antidotes ne dépose aucun cookie publicitaire ni aucun outil de
          mesure d&apos;audience. Seuls sont utilisés le cookie de session, qui
          maintient la connexion, et quelques cookies de préférence
          d&apos;affichage — le rail replié, le tri d&apos;un tableau. Ils ne sortent
          jamais de la plateforme.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation, d&apos;opposition et de portabilité sur les données qui vous
          concernent. Écrivez à{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.email}`}
            className="underline underline-offset-4 hover:text-text-primary"
          >
            {LEGAL_ENTITY.email}
          </a>{" "}
          : la réponse intervient sous un mois. En cas de désaccord, vous
          pouvez saisir la CNIL.
        </p>
      </LegalSection>

      <LegalSection title="Modifications">
        <p>
          Cette politique peut évoluer avec la plateforme. La date de dernière
          mise à jour, en tête de page, fait foi ; un changement substantiel
          est annoncé aux personnes concernées.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
