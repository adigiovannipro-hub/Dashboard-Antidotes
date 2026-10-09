"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Send, X, type LucideIcon } from "lucide-react";

import { publishSubjectNow, scheduleSubject } from "@/app/actions/publication";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import { chipInk, type useCellAction } from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import { cn } from "@/lib/utils";

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
 * Le clic sur une moitié la fait **déborder sur l'autre** : sa couleur gagne
 * la case, le picto s'en va du côté où elle s'étend, le libellé arrive de
 * l'autre (les animations vivent dans `globals.css`, « La case statut qui se
 * remplit »). La case finit comme la pastille que le serveur va rendre, d'où
 * une bascule sans saut. Un refus rejoue la course à l'envers.
 *
 * La petite croix ronde rend la case à « Validé » le temps du survol : c'est
 * le chemin vers le sélecteur de statut, sans quoi une ligne validée ne
 * pourrait plus revenir à « À valider » depuis le tableau. Elle revient dès
 * que la souris quitte la ligne. Au clavier, les deux moitiés apparaissent
 * quand le focus entre dans la case, et la croix rend le focus à la pastille.
 *
 * Publier demande confirmation : une publication ne se retire pas d'ici. Elle
 * tourne côté serveur une à deux minutes (l'encodage d'un reel) ; la case
 * garde « Publié » pendant ce temps, et la page se relit à quelques reprises
 * pour montrer la ligne passer « Publié » pour de bon.
 */
const REFRESH_AFTER_MS = [15_000, 45_000, 120_000];

/** Le temps que la boîte de confirmation se referme avant que la case parte. */
const AFTER_DIALOG_MS = 160;

type Choice = "scheduled" | "published";
type Phase = { choice: Choice; leaving: boolean };
type Label = { color: string; label: string };

export function PublishActions({
  scope,
  subjectId,
  subjectName,
  networks,
  run,
  scheduled,
  published,
  children,
}: {
  scope: Scope;
  subjectId: string;
  subjectName: string;
  /** « Instagram et Facebook » — ce que la confirmation annonce. */
  networks: string;
  run: ReturnType<typeof useCellAction>["run"];
  /** Les étiquettes « Programmé » et « Publié » du tableau. */
  scheduled: Label;
  published: Label;
  /** La pastille de statut, qui reste dessous. */
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase | null>(null);
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

  /** Le refus : la case se vide à l'envers — d'un coup sans animation. */
  const rollBack = (choice: Choice) => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(still ? null : { choice, leaving: true });
  };

  const schedule = async () => {
    setPhase({ choice: "scheduled", leaving: false });
    const result = await run(() => scheduleSubject(scope, subjectId));
    // Accepté : la ligne passe « Programmé » et ce composant se démonte.
    if (!result.ok) rollBack("scheduled");
  };

  // La confirmation se ferme d'abord : la case qui se remplit derrière le
  // voile de la boîte serait une animation que personne ne voit.
  const publish = () => {
    setConfirming(false);
    let started = false;
    const start = window.setTimeout(() => {
      started = true;
      setPhase({ choice: "published", leaving: false });
    }, AFTER_DIALOG_MS);
    timers.current.push(start);
    void run(() => publishSubjectNow(scope, subjectId)).then((result) => {
      if (!result.ok) {
        // Refusé avant même que la case parte : rien à défaire.
        window.clearTimeout(start);
        if (started) rollBack("published");
        return;
      }
      timers.current.push(
        ...REFRESH_AFTER_MS.map((delay, index) =>
          window.setTimeout(() => {
            router.refresh();
            // Toujours « Validé » à la dernière relecture : la publication
            // n'a pas abouti, le journal du sujet dit pourquoi. La case
            // cesse de promettre « Publié ».
            if (index === REFRESH_AFTER_MS.length - 1) setPhase(null);
          }, delay),
        ),
      );
    });
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
        {dismissed && !phase ? null : (
          <span
            className={cn(
              "bg-surface absolute inset-0 gap-px",
              phase ? "flex" : "hidden group-hover/row:flex group-focus-within/statut:flex",
            )}
          >
            <button
              type="button"
              aria-label="Programmer à sa date"
              title="Programmer"
              disabled={phase !== null}
              onClick={schedule}
              className={HALF}
              style={{ backgroundColor: scheduled.color, color: chipInk(scheduled.color) }}
            >
              <CalendarClock className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Publier maintenant"
              title="Publier maintenant"
              disabled={phase !== null}
              onClick={() => setConfirming(true)}
              className={HALF}
              style={{ backgroundColor: published.color, color: chipInk(published.color) }}
            >
              <Send className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
            {phase ? (
              <Fill
                // Une clé neuve au refus : les éléments se remontent, et
                // l'animation repart à l'envers au lieu de sauter à sa fin.
                key={phase.leaving ? "retour" : "aller"}
                phase={phase}
                target={phase.choice === "scheduled" ? scheduled : published}
                onRolledBack={() => setPhase(null)}
              />
            ) : (
              <button
                type="button"
                aria-label="Garder « Validé » et changer le statut"
                title="Changer le statut"
                onClick={dismiss}
                className="focus-visible:ring-ring absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-white text-black shadow-sm ring-1 ring-black/10 outline-none focus-visible:ring-2"
              >
                <X className="size-2.5" strokeWidth={2.5} aria-hidden />
              </button>
            )}
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

/**
 * L'aplat qui gagne la case. Programmer part de la gauche : le calendrier file
 * vers la droite et le libellé arrive par la gauche. Publier part de la
 * droite : l'avion file vers la gauche et le libellé arrive par la droite.
 */
function Fill({
  phase,
  target,
  onRolledBack,
}: {
  phase: Phase;
  target: Label;
  onRolledBack: () => void;
}) {
  const fromLeft = phase.choice === "scheduled";
  const Icon: LucideIcon = fromLeft ? CalendarClock : Send;
  const back = phase.leaving && "statut-retour";

  return (
    <span
      aria-hidden
      onAnimationEnd={(event) => {
        if (phase.leaving && event.target === event.currentTarget) onRolledBack();
      }}
      className={cn(
        "absolute inset-0 overflow-hidden",
        fromLeft ? "statut-remplit-gauche" : "statut-remplit-droite",
        back,
      )}
      style={{ backgroundColor: target.color, color: chipInk(target.color) }}
    >
      <span
        className={cn(
          "absolute inset-y-0 flex w-1/2 items-center justify-center",
          fromLeft ? "statut-picto-droite left-0" : "statut-picto-gauche right-0",
          back,
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      {/* La typographie de la pastille (`ChipSelect`) : la case finit comme
          ce que le serveur va rendre. */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center px-2 text-[11px] font-semibold tracking-wide uppercase",
          fromLeft ? "statut-libelle-gauche" : "statut-libelle-droite",
          back,
        )}
      >
        <span className="truncate">{target.label}</span>
      </span>
    </span>
  );
}

const HALF =
  "focus-visible:ring-ring flex min-w-0 flex-1 items-center justify-center outline-none transition-opacity duration-(--motion-duration) ease-standard enabled:hover:opacity-80 focus-visible:ring-2 focus-visible:ring-inset";
