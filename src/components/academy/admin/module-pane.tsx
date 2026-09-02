"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteLesson,
  deleteModule,
  reorderLessons,
  reorderModules,
  updateLesson,
  updateModule,
  type AcademyResult,
} from "@/app/actions/academy";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddLessonForm } from "@/components/academy/admin/add-forms";
import { CoverUploader } from "@/components/academy/admin/cover-uploader";
import type { AcademyLessonLite } from "@/lib/academy/queries";
import type { AcademyModule } from "@/lib/academy/types";

/**
 * Le panneau d'un module dans le back-office : ses réglages, puis ses leçons
 * — réordonnancement par flèches, publication, suppression en deux temps.
 *
 * La suppression ne passe pas par un dialogue : le bouton devient
 * « Confirmer ? » trois secondes. Assez pour empêcher le clic malheureux,
 * pas assez pour transformer un rangement en cérémonie.
 */

function useConfirm(onConfirm: () => void): { armed: boolean; trigger: () => void } {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return {
    armed,
    trigger: () => {
      if (armed) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setArmed(false);
        onConfirm();
        return;
      }
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 3000);
    },
  };
}

function report(result: AcademyResult) {
  if (!result.ok) toast.error(result.error);
  else if (result.message) toast.success(result.message);
}

/** Monte ou descend `id` d'un cran dans `ids`, sans muter l'entrée. */
function shifted(ids: string[], id: string, direction: -1 | 1): string[] | null {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  next[index] = next[target]!;
  next[target] = id;
  return next;
}

export function ModulePane({
  module,
  courseSlug,
  coverUrl,
  orderedModuleIds,
  lessons,
}: {
  module: AcademyModule;
  courseSlug: string;
  coverUrl: string | null;
  orderedModuleIds: string[];
  lessons: AcademyLessonLite[];
}) {
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const remove = useConfirm(() => {
    startTransition(async () => {
      const result = await deleteModule({ moduleId: module.id });
      report(result);
      if (result.ok) router.replace(`/academy/admin?formation=${courseSlug}`);
    });
  });

  const orderedLessonIds = lessons.map((lesson) => lesson.id);

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          title={`Module — ${module.title}`}
          description={module.published ? "Publié, visible de l'équipe." : "Brouillon, visible de toi seul."}
          action={
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Monter le module"
                disabled={pending}
                onClick={() => {
                  const next = shifted(orderedModuleIds, module.id, -1);
                  if (!next) return;
                  startTransition(async () => {
                    report(await reorderModules({ parentId: module.course_id, orderedIds: next }));
                  });
                }}
              >
                <ArrowUp aria-hidden strokeWidth={1.75} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Descendre le module"
                disabled={pending}
                onClick={() => {
                  const next = shifted(orderedModuleIds, module.id, 1);
                  if (!next) return;
                  startTransition(async () => {
                    report(await reorderModules({ parentId: module.course_id, orderedIds: next }));
                  });
                }}
              >
                <ArrowDown aria-hidden strokeWidth={1.75} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    report(
                      await updateModule({
                        moduleId: module.id,
                        patch: { published: !module.published },
                      }),
                    );
                  });
                }}
              >
                {module.published ? (
                  <EyeOff data-icon="inline-start" aria-hidden strokeWidth={1.75} />
                ) : (
                  <Eye data-icon="inline-start" aria-hidden strokeWidth={1.75} />
                )}
                {module.published ? "Dépublier" : "Publier"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={remove.trigger}
              >
                <Trash2 data-icon="inline-start" aria-hidden strokeWidth={1.75} />
                {remove.armed ? "Confirmer ?" : "Supprimer"}
              </Button>
            </div>
          }
        />
        <div className="border-b border-border p-5">
          <CoverUploader
            kind="module"
            id={module.id}
            coverUrl={coverUrl}
            label={module.title}
          />
        </div>

        <form
          className="space-y-3 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await updateModule({
                moduleId: module.id,
                patch: {
                  title: title.trim(),
                  description: description.trim() === "" ? null : description.trim(),
                },
              });
              report(result.ok ? { ok: true, message: "Module enregistré." } : result);
            });
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="type-caption mb-1 block text-text-secondary">Titre</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="block">
              <span className="type-caption mb-1 block text-text-secondary">
                Description
              </span>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Deux phrases sur ce que le module apprend"
              />
            </label>
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={pending || !title.trim()}>
            Enregistrer le module
          </Button>
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          title="Leçons"
          count={lessons.length}
          description="L'ordre ici est l'ordre de lecture."
        />
        <PanelRows>
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              courseSlug={courseSlug}
              moduleSlug={module.slug}
              orderedLessonIds={orderedLessonIds}
            />
          ))}
        </PanelRows>
        <div className="border-t border-border p-4">
          <AddLessonForm moduleId={module.id} />
        </div>
      </Panel>
    </div>
  );
}

function LessonRow({
  lesson,
  courseSlug,
  moduleSlug,
  orderedLessonIds,
}: {
  lesson: AcademyLessonLite;
  courseSlug: string;
  moduleSlug: string;
  orderedLessonIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const remove = useConfirm(() => {
    startTransition(async () => {
      report(await deleteLesson({ lessonId: lesson.id }));
    });
  });

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="flex shrink-0 flex-col">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Monter « ${lesson.title} »`}
          disabled={pending}
          onClick={() => {
            const next = shifted(orderedLessonIds, lesson.id, -1);
            if (!next) return;
            startTransition(async () => {
              report(await reorderLessons({ parentId: lesson.module_id, orderedIds: next }));
            });
          }}
        >
          <ArrowUp aria-hidden strokeWidth={1.75} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Descendre « ${lesson.title} »`}
          disabled={pending}
          onClick={() => {
            const next = shifted(orderedLessonIds, lesson.id, 1);
            if (!next) return;
            startTransition(async () => {
              report(await reorderLessons({ parentId: lesson.module_id, orderedIds: next }));
            });
          }}
        >
          <ArrowDown aria-hidden strokeWidth={1.75} />
        </Button>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/academy/admin?formation=${courseSlug}&module=${moduleSlug}&lecon=${lesson.slug}`}
          className="type-body block truncate font-medium text-text-primary hover:underline"
        >
          {lesson.title}
        </Link>
        <p className="type-caption text-text-secondary tabular-nums">
          {lesson.duration_min ? `${lesson.duration_min} min` : "durée non renseignée"}
        </p>
      </div>

      <StatusPill tone={lesson.published ? "positive" : "neutral"} className="shrink-0">
        {lesson.published ? "Publiée" : "Brouillon"}
      </StatusPill>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={lesson.published ? `Dépublier « ${lesson.title} »` : `Publier « ${lesson.title} »`}
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            report(
              await updateLesson({
                lessonId: lesson.id,
                patch: { published: !lesson.published },
              }),
            );
          });
        }}
      >
        {lesson.published ? (
          <EyeOff aria-hidden strokeWidth={1.75} />
        ) : (
          <Eye aria-hidden strokeWidth={1.75} />
        )}
      </Button>

      <Button
        render={<Link href={`/academy/admin?formation=${courseSlug}&module=${moduleSlug}&lecon=${lesson.slug}`} />}
        variant="ghost"
        size="icon-sm"
        aria-label={`Éditer « ${lesson.title} »`}
      >
        <Pencil aria-hidden strokeWidth={1.75} />
      </Button>

      <Button
        variant="ghost"
        size={remove.armed ? "sm" : "icon-sm"}
        aria-label={`Supprimer « ${lesson.title} »`}
        disabled={pending}
        onClick={remove.trigger}
        className={remove.armed ? "text-danger-ink" : undefined}
      >
        {remove.armed ? "Confirmer ?" : <Trash2 aria-hidden strokeWidth={1.75} />}
      </Button>
    </div>
  );
}
