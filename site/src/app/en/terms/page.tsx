import type { Metadata } from "next";

import { LegalLink, LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { CGU_MAJ_EN, HEBERGEURS, LEGAL_ENTITY, identityLines } from "@/lib/legal/entity";
import { pageMetadata } from "@/lib/seo";

/** The terms of use in English — a translation of the French page, which prevails. They also serve as legal notice. */
export const metadata: Metadata = pageMetadata("en", "/terms", {
  title: "Terms of use",
  description: "The access and usage rules of the Antidotes platform, and its legal notice.",
});

const GOVERNING_LAW_EN: Record<string, string> = { français: "French" };

export default function TermsPage() {
  const identity = identityLines("en");

  return (
    <LegalPage title="Terms of use" other={{ href: "/en/privacy", label: "Privacy policy →" }} home="/en" updatedLabel="Last updated:" updated={CGU_MAJ_EN}>
      <LegalSection title="Publisher">
        <p>
          Publishing director: {LEGAL_ENTITY.responsable}. Contact: <LegalLink href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</LegalLink>.
        </p>
        {identity.length > 0 ? <p>{identity.join(" · ")}</p> : null}
        <p>Hosting: {HEBERGEURS.map((h) => h.nom).join(", ")}</p>
      </LegalSection>

      <LegalSection title="Purpose">
        <p>
          Antidotes is a professional social media management tool. It brings together the reporting of connected accounts, the editorial calendar, the moderation of comments and messages, and the agency&apos;s administrative management. The antidotes.agency site presents its work and lets you book a meeting.
        </p>
        <p>Access to the platform is reserved for agency members and clients invited by name. There is no open registration.</p>
      </LegalSection>

      <LegalSection title="Access and accounts">
        <p>
          Access is through an authentication link sent to the invited email address. This link is personal: it is not to be shared. Each user is responsible for the actions performed from their account and informs the publisher as soon as they suspect an access that is not their own.
        </p>
        <p>A client accesses only their own workspace, and only the pages opened to them.</p>
      </LegalSection>

      <LegalSection title="Connected social accounts">
        <p>
          Connecting a social account requires being its holder or being authorised to do so. The authorisation is granted by the network itself, is limited to the permissions shown at the time of connection, and can be withdrawn at any time — from the Connections page of Antidotes or from the network.
        </p>
        <p>Antidotes reads these accounts and, when asked to, publishes or replies on their behalf. It acts on no third-party account.</p>
        <p>
          {"TikTok. Connecting a TikTok account means accepting the TikTok Terms of Service for developers and the TikTok Community Guidelines. Before each publication, the user chooses the video's visibility, allows or disallows comments, duets and stitches, declares any commercial content and confirms the use of the music. Antidotes never publishes to TikTok without this explicit action."}
        </p>
      </LegalSection>

      <LegalSection title="Expected use">
        <LegalList
          items={[
            "Do not attempt to access a workspace or data not intended for you.",
            "Do not publish, through the platform, unlawful content or content contrary to the rules of the targeted network.",
            "Do not disrupt the operation of the service, nor extract its data in bulk.",
            "Do not publish to TikTok content that breaches the TikTok Community Guidelines or the obligations to declare commercial content.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          The platform is provided as is, without any guarantee of continuous availability. It depends on third-party programming interfaces — those of social networks and banking services — whose interruption, limitation or modification is beyond the publisher&apos;s control. Missing data is flagged as such and never replaced by an estimate.
        </p>
      </LegalSection>

      <LegalSection title="Ownership">
        <p>
          The code, the interface and the Antidotes name belong to the publisher. Content uploaded by a client — visuals, texts, documents — remains their property; they grant the publisher the right to host and process it for the sole purpose of the service.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          The publisher is responsible for the service conforming to what is described here. It is responsible neither for decisions taken in light of the figures displayed, nor for the consequences of a post approved by the client, nor for a failure of a third-party service.
        </p>
      </LegalSection>

      <LegalSection title="End of access">
        <p>
          Access ends with the service, or on request. When a workspace is closed, its data is deleted under the conditions described in the privacy policy; accounting documents are kept for as long as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by {GOVERNING_LAW_EN[LEGAL_ENTITY.droitApplicable] ?? LEGAL_ENTITY.droitApplicable} law. Failing an amicable settlement, any dispute falls under the competent courts.</p>
      </LegalSection>

      <LegalSection title="Language">
        <p>
          This page is a translation provided for convenience. The <LegalLink href="/cgu">French version</LegalLink> is the reference text and prevails in case of discrepancy.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
