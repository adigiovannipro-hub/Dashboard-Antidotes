"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send, X } from "lucide-react";

import type { PlanningResult } from "@/app/actions/planning";
import { publishSubjectNow, scheduleSubject } from "@/app/actions/publication";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import { chipInk, type useCellAction } from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";

/**
 * La case statut d'une ligne « Validé », vue par l'agence : au survol de la
 * **ligne** — n'importe où, pas seulement sur la case —, elle se coupe en
 * deux moitiés égales — **Programmer** (le calendrier) à gauche, **Publier**
 * (l'envoi) à droite — chacune à la couleur de l'étiquette qu'elle posera,
 * « Programmé » et « Publié ». Le geste se lit avant d'être fait : la case
 * prend la couleur de ce qu'elle deviendra. La première version ne réagissait
 * qu'au survol de la case elle-même : la souris posée sur le sujet ne
 * montrait rien, et le geste passait pour absent.
 *
 * La petite croix ronde rend la case à « Validé » le temps du survol : c'est
 * le chemin vers le sélecteur de statut, sans quoi une ligne validée ne
 * pourrait plus revenir à « À valider » depuis le tableau. Elle revient dès
 * que la souris quitte la ligne. Au clavier, les deux moitiés apparaissent
 * quand le focus entre dans la case, et la croix rend le focus à la pastille.
 *
 * Publier demande confirmation : une publication ne se retire pas d'ici. Elle
 * tourne côté serveur une à deux minutes (l'encodage d'un reel) ; la page se
 * relit à quelques reprises pour montrer la ligne passer « Publié ».
 */
const REFRESH_AFTER_MS = [15_000, 45_000, 120_000];

export function PublishActions({
  scope,
  subjectId,
  subjectName,
  networks,
  run,
  scheduledColor,
  publishedColor,
  children,
}: {
  scope: Scope;
  subjectId: string;
  subjectName: string;
  /** « Instagram et Facebook » — ce que la confirmation annonce. */
  networks: string;
  run: ReturnType<typeof useCellAction>["run"];
  /** Les couleurs des étiquettes « Programmé » et « Publié » du tableau. */
  scheduledColor: string;
  publishedColor: string;
  /** La pastille de statut, qui reste dessous. */
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const container = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // La croix vaut le temps du survol de la ligne : la quitter rend les deux
  // moitiés. Écouté sur la ligne et non sur la case, puisque c'est elle qui
  // les fait apparaître. Un focus laissé dans la case par la souris (la
  // pastille après la croix, le bouton après la confirmation) est rendu au
  // même moment : sans quoi `focus-within` gardait les deux moitiés sur une
  // ligne que la souris avait quittée. Le focus clavier, lui, reste.
  // (`:has(:focus-visible)` évitait la fuite mais cassait Tab : la case se
  // masquait entre la pastille et « Programmer », et le focus tombait sur la
  // page.)
  useEffect(() => {
    const row = container.current?.closest('[role="row"]');
    if (!row) return;
    const reset = () => {
      setDismissed(false);
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        container.current?.contains(active) &&
        !active.matches(":focus-visible")
      ) {
        active.blur();
      }
    };
    row.addEventListener("mouseleave", reset);
    return () => row.removeEventListener("mouseleave", reset);
  }, []);

  const publish = async () => {
    const result: PlanningResult = await run(() => publishSubjectNow(scope, subjectId));
    if (!result.ok) return;
    timers.current = REFRESH_AFTER_MS.map((delay) =>
      window.setTimeout(() => router.refresh(), delay),
    );
  };

  const dismiss = () => {
    setDismissed(true);
    // La pastille reprend le focus : Entrée ouvre aussitôt le sélecteur.
    container.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
  };

  const label = subjectName.trim() ? `« ${subjectName.trim()} »` : "cette publication";

  return (
    <>
      <span ref={container} className="group/statut relative flex w-full items-stretch">
        {children}
        {dismissed ? null : (
          <span className="bg-surface absolute inset-0 hidden gap-px group-hover/row:flex group-focus-within/statut:flex">
            <button
              type="button"
              aria-label="Programmer à sa date"
              title="Programmer"
              onClick={() => run(() => scheduleSubject(scope, subjectId))}
              className={HALF}
              style={{ backgroundColor: scheduledColor, color: chipInk(scheduledColor) }}
            >
              <CalendarClock className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Publier maintenant"
              title="Publier maintenant"
              onClick={() => setConfirming(true)}
              className={HALF}
              style={{ backgroundColor: publishedColor, color: chipInk(publishedColor) }}
            >
              <Send className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Garder « Validé » et changer le statut"
              title="Changer le statut"
              onClick={dismiss}
              className="focus-visible:ring-ring absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-white text-black shadow-sm ring-1 ring-black/10 outline-none focus-visible:ring-2"
            >
              <X className="size-2.5" strokeWidth={2.5} aria-hidden />
            </button>
          </span>
        )}
      </span>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Publier ${label} maintenant`}
        description={`Elle part tout de suite sur ${networks}, sans attendre sa date. Une publication ne se retire pas d'ici.`}
        confirmLabel="Publier"
        confirmVariant="default"
        onConfirm={publish}
      />
    </>
  );
}

const HALF =
  "focus-visible:ring-ring flex min-w-0 flex-1 items-center justify-center outline-none transition-opacity duration-(--motion-duration) ease-standard hover:opacity-80 focus-visible:ring-2 focus-visible:ring-inset";
