"use client";

import { useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { updateCourse } from "@/app/actions/academy";
import { Button } from "@/components/ui/button";

/** Publier ou dépublier la formation entière — le seul réglage du cours. */
export function CoursePublishToggle({
  courseId,
  published,
}: {
  courseId: string;
  published: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await updateCourse({
            courseId,
            patch: { published: !published },
          });
          if (result.ok) {
            toast.success(published ? "Formation dépubliée." : "Formation publiée.");
          } else toast.error(result.error);
        });
      }}
    >
      {published ? (
        <EyeOff data-icon="inline-start" aria-hidden strokeWidth={1.75} />
      ) : (
        <Eye data-icon="inline-start" aria-hidden strokeWidth={1.75} />
      )}
      {published ? "Dépublier la formation" : "Publier la formation"}
    </Button>
  );
}
