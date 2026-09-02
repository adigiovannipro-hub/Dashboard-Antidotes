"use client";

import { useDeferredValue, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { updateLesson, type AcademyResult } from "@/app/actions/academy";
import { ScriptView } from "@/components/academy/script-view";
import { VideoManager } from "@/components/academy/admin/video-manager";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AcademyLesson,
  AcademyResource,
  AcademyResourceKind,
} from "@/lib/academy/types";
import { RESOURCE_KIND_LABELS } from "@/lib/academy/types";

/**
 * L'éditeur d'une leçon : les métadonnées, le script avec son aperçu en
 * direct, la vidéo, les ressources.
 *
 * L'aperçu monte exactement le composant qui rend la page de lecture — même
 * parseur, même typographie — c'est ce qui rend l'aperçu digne de confiance.
 * La frappe passe par `useDeferredValue` : le champ reste fluide, l'aperçu
 * suit d'une respiration.
 */

const KIND_OPTIONS: AcademyResourceKind[] = [
  "template",
  "checklist",
  "link",
  "tool",
  "document",
];

function report(result: AcademyResult, successMessage: string) {
  if (result.ok) toast.success(result.message ?? successMessage);
  else toast.error(result.error);
}

export function LessonEditor({
  lesson,
  courseSlug,
  moduleSlug,
}: {
  lesson: AcademyLesson;
  courseSlug: string;
  moduleSlug: string;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary ?? "");
  const [duration, setDuration] = useState(
    lesson.duration_min === null ? "" : String(lesson.duration_min),
  );
  const [script, setScript] = useState(lesson.script_mdx);
  const [resources, setResources] = useState<AcademyResource[]>(lesson.resources);
  const [pending, startTransition] = useTransition();

  const deferredScript = useDeferredValue(script);

  const save = () => {
    const parsedDuration = duration.trim() === "" ? null : Number(duration);
    if (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 0)) {
      toast.error("La durée doit être un nombre entier de minutes.");
      return;
    }
    startTransition(async () => {
      const result = await updateLesson({
        lessonId: lesson.id,
        patch: {
          title: title.trim(),
          summary: summary.trim() === "" ? null : summary.trim(),
          duration_min: parsedDuration,
          script_mdx: script,
          resources: resources
            .filter((resource) => resource.title.trim() !== "")
            .map((resource) => ({
              ...resource,
              title: resource.title.trim(),
              description:
                resource.description?.trim() === "" ? null : (resource.description?.trim() ?? null),
              url: resource.url?.trim() === "" ? null : (resource.url?.trim() ?? null),
              // Un corps vide ne se stocke pas : le prédicat `isDocumentResource`
              // trancherait « document » sur une chaîne blanche.
              body: resource.body?.trim() ? resource.body.trim() : null,
            })),
        },
      });
      report(result, "Leçon enregistrée.");
    });
  };

  return (
    <div className="space-y-5">
      <Link
        href={`/academy/admin?formation=${courseSlug}&module=${moduleSlug}`}
        className="type-caption inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft aria-hidden strokeWidth={1.75} className="size-3.5" />
        Retour aux leçons du module
      </Link>

      <Panel>
        <PanelHeader
          title={`Leçon — ${lesson.title}`}
          description={
            lesson.published ? "Publiée, visible de l'équipe." : "Brouillon, visible de toi seul."
          }
          action={
            <div className="flex items-center gap-1.5">
              <Button
                render={<Link href={`/academy/${courseSlug}/${moduleSlug}/${lesson.slug}`} />}
                variant="ghost"
                size="sm"
              >
                <ExternalLink data-icon="inline-start" aria-hidden strokeWidth={1.75} />
                Voir la leçon
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await updateLesson({
                      lessonId: lesson.id,
                      patch: { published: !lesson.published },
                    });
                    report(result, lesson.published ? "Leçon dépubliée." : "Leçon publiée.");
                  });
                }}
              >
                {lesson.published ? (
                  <EyeOff data-icon="inline-start" aria-hidden strokeWidth={1.75} />
                ) : (
                  <Eye data-icon="inline-start" aria-hidden strokeWidth={1.75} />
                )}
                {lesson.published ? "Dépublier" : "Publier"}
              </Button>
            </div>
          }
        />
        <PanelBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
            <label className="block">
              <span className="type-caption mb-1 block text-text-secondary">Titre</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="block">
              <span className="type-caption mb-1 block text-text-secondary">
                Résumé (deux phrases)
              </span>
              <Input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="type-caption mb-1 block text-text-secondary">
                Durée (min)
              </span>
              <Input
                inputMode="numeric"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </label>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Vidéo" description="Hébergée ici (50 Mo max) ou embarquée depuis YouTube, Vimeo, Mux." />
        <PanelBody>
          <VideoManager
            lessonId={lesson.id}
            provider={lesson.video_provider}
            videoUrl={lesson.video_url}
            storagePath={lesson.video_storage_path}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Script"
          description="Markdown — l'aperçu de droite est exactement le rendu de la page de lecture."
        />
        <PanelBody>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="sr-only">Script de la leçon, en markdown</span>
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                rows={26}
                spellCheck={false}
                className="type-caption h-full min-h-[32rem] w-full resize-y rounded-md border border-input bg-surface px-3 py-2 font-mono leading-relaxed transition-colors duration-(--motion-duration) ease-standard outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              />
            </label>
            <div className="max-h-[36rem] overflow-y-auto rounded-md border border-border bg-surface-sunken px-5 py-4">
              <ScriptView markdown={deferredScript} />
            </div>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Ressources"
          count={resources.length}
          description="Modèles et checklists sans lien, outils et liens avec leur URL."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setResources((current) => [
                  ...current,
                  { title: "", description: null, kind: "template", url: null },
                ])
              }
            >
              <Plus data-icon="inline-start" aria-hidden strokeWidth={1.75} />
              Ajouter
            </Button>
          }
        />
        <PanelBody className="space-y-3">
          {resources.length === 0 ? (
            <p className="type-caption text-text-secondary">
              Aucune ressource — le volet restera discret côté lecture.
            </p>
          ) : null}
          {resources.map((resource, index) => (
            <div
              key={index}
              className="grid items-center gap-2 rounded-md border border-border p-3 md:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px]"
            >
              <label className="block">
                <span className="sr-only">Nature de la ressource</span>
                <select
                  value={resource.kind}
                  onChange={(event) =>
                    setResources((current) =>
                      current.map((candidate, candidateIndex) =>
                        candidateIndex === index
                          ? { ...candidate, kind: event.target.value as AcademyResourceKind }
                          : candidate,
                      ),
                    )
                  }
                  className="type-caption h-8 w-full rounded-md border border-input bg-surface px-2 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                >
                  {KIND_OPTIONS.map((kind) => (
                    <option key={kind} value={kind}>
                      {RESOURCE_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                value={resource.title}
                placeholder="Titre"
                aria-label="Titre de la ressource"
                className="h-8 text-sm"
                onChange={(event) =>
                  setResources((current) =>
                    current.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? { ...candidate, title: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
              <Input
                value={resource.description ?? ""}
                placeholder="Description (une phrase)"
                aria-label="Description de la ressource"
                className="h-8 text-sm"
                onChange={(event) =>
                  setResources((current) =>
                    current.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? { ...candidate, description: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
              <Input
                value={resource.url ?? ""}
                placeholder="URL (facultative)"
                aria-label="URL de la ressource"
                className="h-8 text-sm"
                onChange={(event) =>
                  setResources((current) =>
                    current.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? { ...candidate, url: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Retirer cette ressource"
                onClick={() =>
                  setResources((current) =>
                    current.filter((_, candidateIndex) => candidateIndex !== index),
                  )
                }
              >
                <Trash2 aria-hidden strokeWidth={1.75} />
              </Button>

              {/* Un document porte son texte : c'est ce qui le distingue d'un
                  simple lien. Le champ n'apparaît que pour cette nature —
                  l'afficher partout donnerait cinq zones vides par leçon. */}
              {resource.kind === "document" ? (
                <label className="block md:col-span-5">
                  <span className="type-caption mb-1 block text-text-secondary">
                    Le document, en markdown
                  </span>
                  <textarea
                    value={resource.body ?? ""}
                    rows={10}
                    placeholder="## Titre&#10;&#10;Le contenu du document, lu et copié depuis la leçon."
                    className="type-caption w-full rounded-md border border-input bg-surface p-3 font-mono outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                    onChange={(event) =>
                      setResources((current) =>
                        current.map((candidate, candidateIndex) =>
                          candidateIndex === index
                            ? { ...candidate, body: event.target.value }
                            : candidate,
                        ),
                      )
                    }
                  />
                </label>
              ) : null}
            </div>
          ))}
        </PanelBody>
      </Panel>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={pending || !title.trim()} className="shadow-card">
          {pending ? "Enregistrement…" : "Enregistrer la leçon"}
        </Button>
      </div>
    </div>
  );
}
