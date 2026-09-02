"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { reorderCourses, updateCourse } from "@/app/actions/academy";
import { CoverUploader } from "@/components/academy/admin/cover-uploader";
import { PendingLabel } from "@/components/ds/pending-label";
import { Panel, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AcademyCourse } from "@/lib/academy/types";

/**
 * Les réglages de la formation : titre, description, couverture, publication,
 * et son rang dans le catalogue.
 *
 * Publier une formation la rend visible de l'équipe **et** des inscrites ;
 * dépublier la retire à tout le monde d'un coup, brouillons de modules
 * compris — la chaîne du publié remonte jusqu'ici.
 */
export function CoursePane({
  course,
  coverUrl,
  orderedCourseIds,
}: {
  course: AcademyCourse;
  coverUrl: string | null;
  orderedCourseIds: string[];
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [pending, start] = useTransition();

  function move(direction: -1 | 1) {
    const index = orderedCourseIds.indexOf(course.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedCourseIds.length) return;
    const next = [...orderedCourseIds];
    next[index] = next[target]!;
    next[target] = course.id;
    start(async () => {
      const result = await reorderCourses({ orderedIds: next });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Panel>
      <PanelHeader
        title={`Formation — ${course.title}`}
        description={
          course.published
            ? "Publiée, visible des inscrites."
            : "Brouillon, visible de toi seul."
        }
        action={
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Monter la formation dans le catalogue"
              disabled={pending}
              onClick={() => move(-1)}
            >
              <ArrowUp aria-hidden strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Descendre la formation dans le catalogue"
              disabled={pending}
              onClick={() => move(1)}
            >
              <ArrowDown aria-hidden strokeWidth={1.75} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const result = await updateCourse({
                    courseId: course.id,
                    patch: { published: !course.published },
                  });
                  if (result.ok) {
                    toast.success(
                      course.published ? "Formation dépubliée." : "Formation publiée.",
                    );
                  } else toast.error(result.error);
                });
              }}
            >
              {course.published ? (
                <EyeOff data-icon="inline-start" aria-hidden strokeWidth={1.75} />
              ) : (
                <Eye data-icon="inline-start" aria-hidden strokeWidth={1.75} />
              )}
              {course.published ? "Dépublier" : "Publier"}
            </Button>
          </div>
        }
      />

      <div className="space-y-5 p-5">
        <CoverUploader
          kind="course"
          id={course.id}
          coverUrl={coverUrl}
          label={course.title}
        />

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await updateCourse({
                courseId: course.id,
                patch: {
                  title: title.trim(),
                  description: description.trim() === "" ? null : description.trim(),
                },
              });
              if (result.ok) toast.success("Formation enregistrée.");
              else toast.error(result.error);
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
                placeholder="Deux phrases sur ce que la formation apprend"
              />
            </label>
          </div>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending || !title.trim()}
          >
            <PendingLabel pending={pending} busy="Enregistrement…">
              Enregistrer la formation
            </PendingLabel>
          </Button>
        </form>
      </div>
    </Panel>
  );
}
