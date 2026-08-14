"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar } from "lucide-react";

import { monthLabel, type MonthKey } from "@/lib/reporting/period";

/**
 * Le mois lu par le rapport.
 *
 * Le mois vit dans l'URL, en français comme les autres filtres : un rapport
 * s'envoie par copie du lien, et le destinataire doit tomber sur le même mois
 * que l'expéditeur.
 *
 * Le mois en cours n'est pas proposé — il n'est pas fini. Le comparer à un
 * mois entier ferait lire une chute là où il ne manque que des jours.
 */
export function MonthPicker({
  current,
  options,
}: {
  current: MonthKey;
  options: readonly MonthKey[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const pick = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mois", next);
    startTransition(() => {
      router.push(`${pathname}?${params}`, { scroll: false });
    });
  };

  return (
    <label className="border-border bg-surface focus-within:ring-accent/20 inline-flex h-9 items-center gap-2 rounded-md border px-2.5 focus-within:ring-2">
      <Calendar
        className="text-text-tertiary size-4 shrink-0"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="sr-only">Mois du rapport</span>
      <select
        value={current}
        disabled={pending}
        onChange={(event) => pick(event.target.value)}
        className="type-label text-text-primary bg-transparent pr-1 outline-none disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {monthLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
