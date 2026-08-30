"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createCourse, createLesson, createModule } from "@/app/actions/academy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Les trois formulaires d'ajout du back-office — un champ, un bouton.
 *
 * L'élément naît en brouillon avec un slug dérivé du titre ; tout le reste
 * s'édite ensuite. Un formulaire de création à douze champs ne fait que
 * retarder le moment où l'on écrit.
 */

function AddForm({
  placeholder,
  submitLabel,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (title: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const value = title.trim();
        if (!value) return;
        startTransition(async () => {
          const result = await onSubmit(value);
          if (result.ok) setTitle("");
          else toast.error(result.error ?? "L'ajout a échoué.");
        });
      }}
    >
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 flex-1 text-sm"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending || !title.trim()}>
        <Plus data-icon="inline-start" aria-hidden strokeWidth={1.75} />
        {pending ? "Ajout…" : submitLabel}
      </Button>
    </form>
  );
}

export function AddModuleForm({ courseId }: { courseId: string }) {
  return (
    <AddForm
      placeholder="Titre du nouveau module"
      submitLabel="Ajouter"
      onSubmit={(title) => createModule({ courseId, title, description: null })}
    />
  );
}

export function AddLessonForm({ moduleId }: { moduleId: string }) {
  return (
    <AddForm
      placeholder="Titre de la nouvelle leçon"
      submitLabel="Ajouter"
      onSubmit={(title) => createLesson({ moduleId, title })}
    />
  );
}

export function CreateCourseForm() {
  return (
    <AddForm
      placeholder="Titre de la formation"
      submitLabel="Créer"
      onSubmit={(title) => createCourse({ title, description: null })}
    />
  );
}
