"use client";

import { SectionHeader } from "@/components/ds/surface";
import { normalizeDeliverables } from "@/lib/context/deliverables";
import type { ClientContext } from "@/lib/context/types";

import { BriefFieldCard } from "./brief-field-card";
import { DeliverablesEditor } from "./deliverables-editor";
import { PillarEditor } from "./pillar-editor";
import { PlatformEditor } from "./platform-editor";

/**
 * Le brief éditorial, en trois familles.
 *
 * Une seule grille de douze colonnes mettait sur le même plan ce qui décrit
 * la marque, ce qu'on publie et la façon de l'écrire : neuf cartes à lire
 * d'affilée sans savoir laquelle répond à quoi. Les empans restent inégaux,
 * la place de chaque champ dit toujours son poids, mais chaque rubrique
 * s'ouvre maintenant sous son titre.
 */
export function BriefGrid({
  workspaceSlug,
  context,
  readOnly,
  editHint,
}: {
  workspaceSlug: string;
  context: ClientContext | null;
  readOnly: boolean;
  editHint: boolean;
}) {
  const deliverables = normalizeDeliverables(context?.deliverables);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="La marque"
          description="Qui elle est, ce qu'elle vend, à qui elle parle."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          <BriefFieldCard
            className="md:col-span-7"
            workspaceSlug={workspaceSlug}
            field="main_context"
            label="Contexte principal"
            hint="Qui est la marque, ce qu'elle vend, à quel prix, avec quel héritage, dans quel marché."
            value={context?.main_context ?? ""}
            minHeightClass="min-h-48"
            readOnly={readOnly}
            editHint={editHint}
          />

          {/* Positionnement et cibles se lisent contre le contexte principal,
              pas en dessous : une colonne à côté, deux cartes empilées. */}
          <div className="flex flex-col gap-5 md:col-span-5">
            <BriefFieldCard
              className="flex-1"
              workspaceSlug={workspaceSlug}
              field="positioning"
              label="Positionnement"
              value={context?.positioning ?? ""}
              minHeightClass="min-h-16"
              readOnly={readOnly}
              editHint={editHint}
            />
            <BriefFieldCard
              className="flex-1"
              workspaceSlug={workspaceSlug}
              field="audience"
              label="Cibles"
              value={context?.audience ?? ""}
              minHeightClass="min-h-16"
              readOnly={readOnly}
              editHint={editHint}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Le contenu"
          description="Ce qu'on publie chaque mois, et de quoi ça parle."
        />
        <div className="flex flex-col gap-5">
          {/* Une clé par version : changer de version remonte les éditeurs
              avec leurs nouvelles valeurs, sans état résiduel. */}
          <DeliverablesEditor
            key={`livrables-${context?.id ?? "vide"}`}
            workspaceSlug={workspaceSlug}
            deliverables={deliverables}
            readOnly={readOnly}
          />
          <PillarEditor
            key={`piliers-${context?.id ?? "vide"}`}
            workspaceSlug={workspaceSlug}
            pillars={context?.pillars ?? []}
            readOnly={readOnly}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader
          title="La parole"
          description="Comment ça s'écrit, et ce qui ne s'écrit jamais."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          <BriefFieldCard
            className="md:col-span-4"
            workspaceSlug={workspaceSlug}
            field="tone_of_voice"
            label="Tone of voice"
            value={context?.tone_of_voice ?? ""}
            minHeightClass="min-h-20"
            readOnly={readOnly}
            editHint={editHint}
          />
          <BriefFieldCard
            className="md:col-span-4"
            workspaceSlug={workspaceSlug}
            field="mentions"
            label="Mentions"
            value={context?.mentions ?? ""}
            minHeightClass="min-h-20"
            readOnly={readOnly}
            editHint={editHint}
          />
          <BriefFieldCard
            className="md:col-span-4"
            workspaceSlug={workspaceSlug}
            field="restrictions"
            label="Interdits"
            hint="Contraignants : reportés tels quels dans les prompts, jamais adoucis."
            value={context?.restrictions ?? ""}
            minHeightClass="min-h-20"
            readOnly={readOnly}
            editHint={editHint}
          />

          <PlatformEditor
            key={`plateformes-${context?.id ?? "vide"}`}
            className="md:col-span-12"
            workspaceSlug={workspaceSlug}
            platforms={context?.platforms ?? {}}
            reseaux={deliverables.reseaux}
            readOnly={readOnly}
          />
        </div>
      </section>
    </div>
  );
}
