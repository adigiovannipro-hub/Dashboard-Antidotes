import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, LegalSection, LegalTerms } from "@/components/legal/legal-page";
import { HEBERGEURS, LEGAL_ENTITY, LEGAL_MAJ_EN, hasEuRepresentative, identityLines } from "@/lib/legal/entity";
import { pageMetadata } from "@/lib/seo";

/**
 * The privacy policy in English — a faithful translation of the French
 * page, which remains the reference text (the last section says so).
 */
export const metadata: Metadata = pageMetadata("en", "/privacy", {
  title: "Privacy policy",
  description: "How Antidotes handles the data of its users, of connected social accounts and of this site's visitors.",
});

const HOST_ROLES_EN: Record<string, string> = {
  "Vercel Inc.": "hosting of the application",
  "Supabase Inc.": "hosting of the database and files",
};

export default function PrivacyPage() {
  const identity = identityLines("en");

  return (
    <LegalPage title="Privacy policy" other={{ href: "/en/terms", label: "Terms of use →" }} home="/en" updatedLabel="Last updated:" updated={LEGAL_MAJ_EN}>
      <LegalSection title="Who is responsible for processing">
        <p>
          {LEGAL_ENTITY.nom} is the controller for the processing described below. Publishing director: {LEGAL_ENTITY.responsable}.
        </p>
        {identity.length > 0 ? <p>{identity.join(" · ")}</p> : null}
        <p>
          For any question, or to exercise your rights: <LegalLink href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="This site and the meeting">
        <p>
          The antidotes.agency site presents the agency&apos;s work and offers a social media management and presence score, delivered during a meeting. To do so, it collects, with your explicit consent: your first name and email address, your answers to the questionnaire, your browser&apos;s time zone and, if you book a meeting, your name, your company, your phone number if you give it, and the chosen slot.
        </p>
        <p>
          This data is used only to compute your score, to organise and confirm your meeting (confirmation email, reminder the day before, event in the agency&apos;s calendar with you as a guest), and to prepare the conversation. It is neither sold, nor transferred, nor used to send you a newsletter without your agreement. It is kept for three years after the last contact, then deleted. This site sets no advertising or analytics cookie; it only keeps, for the duration of your visit, the progress of your questionnaire in your browser.
        </p>
      </LegalSection>

      <LegalSection title="What Antidotes is">
        <p>
          Antidotes is an internal working tool of the agency, opened to its clients for the part that concerns them. It gathers the reporting of social accounts, the editorial calendar, the moderation of comments and messages, and the agency&apos;s administrative management.
        </p>
        <p>It is not a consumer service: access is by named invitation, and each client only sees their own workspace.</p>
      </LegalSection>

      <LegalSection title="The data processed">
        <p>Three families, which never mix.</p>
        <p>
          <strong className="text-text">The accounts of the people who use the platform.</strong> Email address, name, role in a workspace, and the log of actions performed (who changed what, and when). The address is used for magic-link authentication: no password is stored.
        </p>
        <p>
          <strong className="text-text">The data of connected social accounts.</strong> When a client authorises Antidotes to read an account, the platform collects that account&apos;s statistics (impressions, reach, clicks, reactions, followers), the list of its posts with their text and thumbnail, and — for workspaces that use moderation — the comments and private messages received, with their author&apos;s handle and avatar.
        </p>
        <p>
          <strong className="text-text">The agency&apos;s management data.</strong> Invoices, bank transactions and accounting documents. They only concern the agency and are accessible to no client.
        </p>
      </LegalSection>

      <LegalSection title="Why, and on what basis">
        <LegalTerms
          items={[
            { term: "Consent", text: "collecting your address and your answers on this site, to compute your score and organise your meeting." },
            { term: "Performance of the contract", text: "producing the reporting, planning and publishing content, answering comments and messages, invoicing the service." },
            { term: "Legitimate interest", text: "securing access and keeping a log of actions, to know who did what on a shared workspace." },
            { term: "Legal obligation", text: "keeping accounting documents for the period required by law." },
          ]}
        />
        <p>No data is sold, rented or transferred. None is used for advertising targeting, nor to train an artificial intelligence model.</p>
      </LegalSection>

      <LegalSection title="Data coming from TikTok">
        <p>
          When a TikTok account is connected, Antidotes requests three permissions and not one more: <code className="type-caption rounded-sm bg-ink-2 px-1 py-0.5">user.info.basic</code>, <code className="type-caption rounded-sm bg-ink-2 px-1 py-0.5">user.info.stats</code> and <code className="type-caption rounded-sm bg-ink-2 px-1 py-0.5">video.list</code>.
        </p>
        <p>
          They are used only to display, in the account holder&apos;s workspace, their own statistics: number of followers, and views, likes, comments and shares of their public videos. This data is shown to no one other than the holder and the agency team managing the account.
        </p>
        <p>
          Antidotes reads no third-party TikTok account, publishes nothing without an explicit request, and uses this data neither for advertising nor to train a model. Disconnecting the account from the Connections page deletes the access token and the collected data.
        </p>
      </LegalSection>

      <LegalSection title="Who else has access">
        <p>Antidotes relies on technical providers, each for a precise role:</p>
        <LegalTerms
          items={[
            ...HEBERGEURS.map((h) => ({ term: h.nom, text: `${HOST_ROLES_EN[h.nom] ?? h.role}.` })),
            { term: "Composio", text: "authorisation gateway to LinkedIn, TikTok, Google Analytics and — for this site — to the agency's Gmail mailbox and Google calendar, which send your confirmations and create your meeting." },
            { term: "Meta, Google, LinkedIn, TikTok", text: "the networks themselves, whose programming interfaces provide the data of each connected account." },
            { term: "Anthropic", text: "drafting reply suggestions and reading accounting documents. The content transmitted is not used to train models." },
            { term: "Airwallex", text: "the agency's bank accounts and invoicing." },
            { term: "GitHub", text: "running scheduled synchronisations." },
          ]}
        />
        <p>
          {LEGAL_ENTITY.nom} is established in {LEGAL_ENTITY.juridiction}, and some of these providers are also established outside the European Union. The corresponding transfers are governed by the European Commission&apos;s standard contractual clauses.
        </p>
      </LegalSection>

      {hasEuRepresentative() ? (
        <LegalSection title="Representative in the European Union">
          <p>
            In accordance with Article 27 of the GDPR, {LEGAL_ENTITY.representantUE.nom} represents {LEGAL_ENTITY.nom} in the European Union for any question relating to data processing. {LEGAL_ENTITY.representantUE.adresse}
            {LEGAL_ENTITY.representantUE.email ? ` — ${LEGAL_ENTITY.representantUE.email}` : ""}
          </p>
        </LegalSection>
      ) : null}

      <LegalSection title="For how long">
        <LegalList
          items={[
            "Data from this site (first name, address, answers, meeting): three years after the last contact.",
            "Accounts and activity logs: as long as access is open, then twelve months.",
            "Statistics and posts of social accounts: for the whole duration of the service — the value of a history is precisely its length — then deleted when the workspace is closed.",
            "Comments and messages: three years, the usual length of a business relationship.",
            "Access tokens to the networks: encrypted, and deleted as soon as the account is disconnected.",
            "Accounting documents: ten years, as required by law.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Exchanges are encrypted end to end. Access tokens to social networks are encrypted in the database and never sent to the browser. The separation between client workspaces is enforced by the database itself, not by the interface alone — each module comes with tests that verify a client can neither read nor modify another client&apos;s workspace. The data from this site is held in a separate database that no public interface can read.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Antidotes sets no advertising cookie and no audience measurement tool. On the platform, only the session cookie, which keeps you signed in, and a few display preference cookies are used. On this site, no cookie is set.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You have a right of access, rectification, erasure, restriction, objection and portability over the data concerning you, and you may withdraw your consent at any time. Write to <LegalLink href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</LegalLink>: a reply is given within one month. In case of disagreement, you may refer the matter to the data protection authority of your country of residence — in France, the CNIL.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>This policy may evolve with the platform. The date of last update, at the top of the page, is authoritative; a substantial change is announced to the people concerned.</p>
      </LegalSection>

      <LegalSection title="Language">
        <p>
          This page is a translation provided for convenience. The <LegalLink href="/confidentialite">French version</LegalLink> is the reference text and prevails in case of discrepancy.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
