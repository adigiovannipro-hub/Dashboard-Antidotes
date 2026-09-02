import { ChevronRight, ExternalLink } from "lucide-react";

import { ScriptView } from "@/components/academy/script-view";
import { StatusPill } from "@/components/ds/status-pill";
import {
  isDocumentResource,
  RESOURCE_KIND_LABELS,
  type AcademyResource,
} from "@/lib/academy/types";

/**
 * Les ressources d'une leçon.
 *
 * Trois natures cohabitent : un **lien** vers un outil extérieur, un support à
 * fabriquer soi-même (modèle, checklist — un titre et une description
 * suffisent), et un **document** qui porte son propre texte. Ce dernier est la
 * raison d'être de ce composant : un contrat type ou une grille tarifaire ne
 * sert à rien en pièce jointe, il sert lu, à côté de la leçon qui l'explique.
 *
 * Le pli est un `<details>` natif — aucun état client, aucune hydratation, et
 * le contenu reste trouvable par la recherche du navigateur une fois ouvert.
 */
export function ResourceList({ resources }: { resources: AcademyResource[] }) {
  if (resources.length === 0) {
    return (
      <p className="type-body text-text-secondary">
        Aucune ressource pour cette leçon.
      </p>
    );
  }

  return (
    <ul className="max-w-[72ch] space-y-3">
      {resources.map((resource, index) => (
        <li
          key={index}
          className="rounded-md border border-border bg-surface px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="neutral" dot={false}>
              {RESOURCE_KIND_LABELS[resource.kind] ?? "Ressource"}
            </StatusPill>
            {resource.url ? (
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="type-body inline-flex items-center gap-1.5 font-medium text-accent-ink underline-offset-2 hover:underline"
              >
                {resource.title}
                <ExternalLink aria-hidden strokeWidth={1.75} className="size-3.5" />
              </a>
            ) : (
              <span className="type-body font-medium text-text-primary">
                {resource.title}
              </span>
            )}
          </div>

          {resource.description ? (
            <p className="type-caption mt-1 text-text-secondary">
              {resource.description}
            </p>
          ) : null}

          {isDocumentResource(resource) ? (
            <details className="group/doc mt-2">
              <summary className="type-caption inline-flex cursor-pointer list-none items-center gap-1 font-medium text-accent-ink underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <ChevronRight
                  aria-hidden
                  strokeWidth={1.75}
                  className="size-3.5 transition-transform duration-(--motion-duration) ease-standard group-open/doc:rotate-90 motion-reduce:transition-none"
                />
                Ouvrir le document
              </summary>
              <div className="mt-3 border-t border-border pt-3">
                <ScriptView markdown={resource.body} />
              </div>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
