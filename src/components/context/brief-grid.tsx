"use client";

import type { ClientContext } from "@/lib/context/types";

import { BriefFieldCard } from "./brief-field-card";
import { PillarEditor } from "./pillar-editor";
import { PlatformEditor } from "./platform-editor";

/**
 * Le brief éditorial en grille inégale : douze colonnes, des empans explicites
 * — la place de chaque champ dit son importance. Le contexte principal et les
 * piliers prennent toute la largeur, les champs d'appoint se serrent à trois
 * par rangée.
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
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
      <BriefFieldCard
        className="md:col-span-12"
        workspaceSlug={workspaceSlug}
        field="main_context"
        label="Contexte principal"
        hint="Qui est la marque, ce qu'elle vend, à quel prix, avec quel héritage, dans quel marché."
        value={context?.main_context ?? ""}
        minHeightClass="min-h-44"
        readOnly={readOnly}
        editHint={editHint}
      />

      {/* Une clé par version : changer de version remonte les éditeurs avec
          leurs nouvelles valeurs, sans état résiduel. */}
      <PillarEditor
        key={`piliers-${context?.id ?? "vide"}`}
        className="md:col-span-12"
        workspaceSlug={workspaceSlug}
        pillars={context?.pillars ?? []}
        readOnly={readOnly}
      />

      <BriefFieldCard
        className="md:col-span-6"
        workspaceSlug={workspaceSlug}
        field="positioning"
        label="Positionnement"
        value={context?.positioning ?? ""}
        minHeightClass="min-h-28"
        readOnly={readOnly}
        editHint={editHint}
      />
      <BriefFieldCard
        className="md:col-span-6"
        workspaceSlug={workspaceSlug}
        field="audience"
        label="Cibles"
        value={context?.audience ?? ""}
        minHeightClass="min-h-28"
        readOnly={readOnly}
        editHint={editHint}
      />

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
        readOnly={readOnly}
      />
    </div>
  );
}
