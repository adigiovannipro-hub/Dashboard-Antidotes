"use client";

import { SectionHeader } from "@/components/ds/surface";
import {
  normalizeDeliverables,
  summarizeDeliverables,
  totalPublications,
} from "@/lib/context/deliverables";
import type { ClientContext } from "@/lib/context/types";
import { formatValue } from "@/lib/format";

import { BriefBlock, firstLine } from "./brief-block";
import { BriefField } from "./brief-field";
import { DeliverablesEditor } from "./deliverables-editor";
import { PillarEditor } from "./pillar-editor";
import { PlatformEditor } from "./platform-editor";
import { SourcedFactsEditor } from "./sourced-facts-editor";
import { ValidatedExamplesEditor } from "./validated-examples-editor";

/**
 * Le brief éditorial, en trois familles : la marque, le contenu, l'écriture.
 *
 * Chaque bloc est replié dès qu'il est rempli, et une ligne de résumé dit ce
 * qu'il contient. Un brief complet occupait trois écrans de champs qu'on ne
 * vient pas relire, et le seul champ vide — celui qu'on vient remplir — s'y
 * noyait ; c'est l'inverse maintenant, et la barre de complétude renvoie
 * directement sur les blocs restés ouverts.
 */
export function BriefGrid({
  workspaceSlug,
  context,
  readOnly,
}: {
  workspaceSlug: string;
  context: ClientContext | null;
  readOnly: boolean;
}) {
  const deliverables = normalizeDeliverables(context?.deliverables);
  const reseaux = deliverables.reseaux.map((network) => network.nom);
  const publications = totalPublications(deliverables);
  const pillars = context?.pillars ?? [];
  const platformRules = Object.entries(context?.platforms ?? {}).filter(([, rule]) =>
    rule.trim(),
  );
  const examples = context?.validated_examples ?? [];
  const facts = context?.sourced_facts ?? [];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeader title="La marque" />
        <div className="flex flex-col gap-5">
          <BriefBlock
            id="marque"
            title="La marque"
            hint="Qui elle est, ce qu'elle vend, à quel prix, avec quel héritage, dans quel marché, et comment elle se positionne."
            filled={Boolean(context?.main_context?.trim())}
            summary={firstLine(context?.main_context)}
          >
            <BriefField
              workspaceSlug={workspaceSlug}
              field="main_context"
              label="La marque"
              value={context?.main_context ?? ""}
              rows={10}
              readOnly={readOnly}
            />
          </BriefBlock>

          <BriefBlock
            id="cibles"
            title="Cibles"
            filled={Boolean(context?.audience?.trim())}
            summary={firstLine(context?.audience)}
          >
            <BriefField
              workspaceSlug={workspaceSlug}
              field="audience"
              label="Cibles"
              value={context?.audience ?? ""}
              rows={4}
              readOnly={readOnly}
            />
          </BriefBlock>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Le contenu" />
        <div className="flex flex-col gap-5">
          <BriefBlock
            id="livrables"
            title="Livrables mensuels"
            hint="Les réseaux du client et ce qui est dû sur chacun. Un bloc de quantités n'apparaît que pour les réseaux cochés."
            filled={publications > 0}
            summary={
              publications > 0
                ? `${formatValue(publications, "integer")} par mois — ${summarizeDeliverables(deliverables)}`
                : ""
            }
            flush
          >
            {/* Une clé par version : changer de version remonte les éditeurs
                avec leurs nouvelles valeurs, sans état résiduel. */}
            <DeliverablesEditor
              key={`livrables-${context?.id ?? "vide"}`}
              workspaceSlug={workspaceSlug}
              deliverables={deliverables}
              readOnly={readOnly}
            />
          </BriefBlock>

          <BriefBlock
            id="piliers"
            title="Piliers de contenu"
            hint="Le cœur de la génération : chaque pilier doit suffire à écrire un post sans autre information."
            filled={pillars.length > 0}
            summary={pillars.map((pillar) => pillar.nom).filter(Boolean).join(" · ")}
            flush
          >
            <PillarEditor
              key={`piliers-${context?.id ?? "vide"}`}
              workspaceSlug={workspaceSlug}
              pillars={pillars}
              readOnly={readOnly}
            />
          </BriefBlock>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="L'écriture" />
        <div className="flex flex-col gap-5">
          <BriefBlock
            id="ton"
            title="Tone of voice"
            filled={Boolean(context?.tone_of_voice?.trim())}
            summary={firstLine(context?.tone_of_voice)}
          >
            <BriefField
              workspaceSlug={workspaceSlug}
              field="tone_of_voice"
              label="Tone of voice"
              value={context?.tone_of_voice ?? ""}
              rows={5}
              readOnly={readOnly}
            />
          </BriefBlock>

          <BriefBlock
            id="plateformes"
            title="Règles par plateforme"
            hint="Format, longueur, emojis, hashtags, tutoiement, mentions obligatoires — réseau par réseau."
            filled={platformRules.length > 0}
            summary={platformRules.map(([platform]) => platform).join(" · ")}
            flush
          >
            <PlatformEditor
              key={`plateformes-${context?.id ?? "vide"}`}
              workspaceSlug={workspaceSlug}
              platforms={context?.platforms ?? {}}
              reseaux={reseaux}
              readOnly={readOnly}
            />
          </BriefBlock>

          {/* Les interdits gardent une bordure à eux : ils ne se lisent pas
              comme une préférence de style, ils se reportent tels quels dans
              les prompts et ne s'adoucissent jamais. */}
          <BriefBlock
            id="interdits"
            title="Interdits"
            hint="Contraignants : reportés tels quels dans les prompts, jamais adoucis."
            tone="danger"
            filled={Boolean(context?.restrictions?.trim())}
            summary={firstLine(context?.restrictions)}
          >
            <BriefField
              workspaceSlug={workspaceSlug}
              field="restrictions"
              label="Interdits"
              value={context?.restrictions ?? ""}
              rows={5}
              readOnly={readOnly}
            />
          </BriefBlock>

          <BriefBlock
            id="exemples"
            title="Exemples validés"
            hint="Trois à cinq publications réelles, approuvées par le client, collées brutes."
            filled={examples.length > 0}
            summary={`${formatValue(examples.length, "integer")} exemple${examples.length > 1 ? "s" : ""}`}
          >
            <ValidatedExamplesEditor
              key={`exemples-${context?.id ?? "vide"}`}
              workspaceSlug={workspaceSlug}
              examples={examples}
              reseaux={reseaux}
              readOnly={readOnly}
            />
          </BriefBlock>

          <BriefBlock
            id="retours"
            title="Retours du client"
            hint="Ce qu'il a fait corriger ou refuser, les formulations bannies, les angles écartés."
            filled={Boolean(context?.client_feedback?.trim())}
            summary={firstLine(context?.client_feedback)}
          >
            <BriefField
              workspaceSlug={workspaceSlug}
              field="client_feedback"
              label="Retours du client"
              value={context?.client_feedback ?? ""}
              rows={6}
              readOnly={readOnly}
            />
          </BriefBlock>

          <BriefBlock
            id="faits"
            title="Faits sourcés"
            hint="Les seuls chiffres et affirmations que la génération a le droit d'écrire."
            filled={facts.length > 0}
            summary={`${formatValue(facts.length, "integer")} fait${facts.length > 1 ? "s" : ""}`}
          >
            <SourcedFactsEditor
              key={`faits-${context?.id ?? "vide"}`}
              workspaceSlug={workspaceSlug}
              facts={facts}
              readOnly={readOnly}
            />
          </BriefBlock>
        </div>
      </section>
    </div>
  );
}
