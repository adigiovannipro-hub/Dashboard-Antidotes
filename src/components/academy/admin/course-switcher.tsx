"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Le sélecteur de formation du back-office.
 *
 * Il navigue plutôt que de filtrer sur place : la formation choisie vit dans
 * l'URL, donc un lien vers le back-office d'une formation se partage et le
 * retour arrière fonctionne. Changer de formation remet à zéro le module et la
 * leçon ouverts — un module de l'une n'existe pas dans l'autre.
 */
export function CourseSwitcher({
  courses,
  current,
}: {
  courses: { slug: string; title: string; published: boolean }[];
  current: string;
}) {
  const router = useRouter();

  if (courses.length < 2) return null;

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        if (typeof value === "string" && value !== current) {
          router.push(`/academy/admin?formation=${value}`);
        }
      }}
    >
      <SelectTrigger size="sm" className="w-56" aria-label="Formation">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {courses.map((course) => (
          <SelectItem key={course.slug} value={course.slug}>
            {course.published ? course.title : `${course.title} (brouillon)`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
