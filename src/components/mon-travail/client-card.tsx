"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Ellipsis,
  Lightbulb,
  Loader2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RUNNING_LABELS,
  type CardJob,
  type JobPayload,
  type ProductionCardModel,
} from "@/lib/production/card-model";
import {
  ACTIVE_JOB_STATUSES,
  PHASE_LABELS,
  PHASE_ORDER,
  type ProductionPhase,
} from "@/lib/production/types";
import type { SegmentTone } from "@/lib/production/phases";
import { cn } from "@/lib/utils";

/**
 * La carte d'un espace client, version cockpit de production.
 *
 * Elle remplace la carte de navigation pour l'owner : le cycle du mois en
 * quatre segments, les mesures de la phase courante, et l'action IA qui fait
 * avancer. Ce n'est plus une `NavCard` — un lien qui contiendrait un menu et
 * un bouton serait du HTML imbriqué invalide — mais le nom, lui, reste un
 * lien vers l'espace.
 *
 * Pendant un job, la carte interroge `/api/jobs/[id]` toutes les 3 secondes
 * et le bouton devient son témoin ; au verdict, un toast et un rafraîchissement
 * serveur realignent tout le monde.
 */

const POLL_INTERVAL_MS = 3000;

const PHASE_ICONS: Record<ProductionPhase, typeof Lightbulb> = {
  intentions: Lightbulb,
  wording: Pencil,
  programmation: CalendarPlus,
  reporting: BarChart3,
};

/* Les teintes vives portent les segments — ce sont des marques, pas du texte.
   Le gris est la bordure appuyée : un segment à venir est un rail vide. */
const TONE_BG: Record<SegmentTone, string> = {
  ok: "bg-brand",
  urgent: "bg-warning",
  idle: "bg-border-strong",
};

export function ClientCard({
  workspaceId,
  slug,
  name,
  accentColor,
  logoUrl,
  model,
}: {
  workspaceId: string;
  slug: string;
  name: string;
  accentColor: string | null;
  /** Logo signé de l'espace. Il remplace la pastille de couleur. */
  logoUrl?: string | null;
  model: ProductionCardModel;
}) {
  const router = useRouter();
  const [job, setJob] = useState<CardJob | null>(model.activeJob);
  const [launching, setLaunching] = useState(false);
  const [stopping, setStopping] = useState(false);
  // Le mois travaillé. Jamais mémorisé d'un rendu à l'autre : la carte
  // s'ouvre sur le mois par défaut, sans quoi un choix d'hier cacherait le
  // retard d'aujourd'hui. `sens` ne sert qu'à faire entrer le contenu du bon
  // côté — la flèche et le mouvement doivent raconter la même chose.
  const [moisIndex, setMoisIndex] = useState(0);
  const [sens, setSens] = useState<"suivant" | "precedent">("suivant");
  // Le verdict ne doit sonner qu'une fois, même si un rendu s'intercale.
  const settledJobId = useRef<string | null>(null);

  // Le serveur reprend la main à chaque refresh : son état remplace le local.
  // Ajusté pendant le rendu, pas dans un effet — le pattern « adjusting state
  // when props change » de React, qui évite un aller-retour de rendu.
  const serverJobKey = model.activeJob
    ? `${model.activeJob.id}:${model.activeJob.status}:${model.activeJob.current}`
    : "none";
  const [seenServerJobKey, setSeenServerJobKey] = useState(serverJobKey);
  if (seenServerJobKey !== serverJobKey) {
    setSeenServerJobKey(serverJobKey);
    setJob(model.activeJob);
  }

  const jobActive = job !== null && ACTIVE_JOB_STATUSES.includes(job.status);

  useEffect(() => {
    if (!job || !ACTIVE_JOB_STATUSES.includes(job.status)) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { ok: boolean; job: JobPayload };
        if (cancelled || !payload.ok) return;

        setJob(payload.job);

        if (ACTIVE_JOB_STATUSES.includes(payload.job.status)) return;
        if (settledJobId.current === payload.job.id) return;
        settledJobId.current = payload.job.id;

        if (payload.job.status === "done") {
          toast.success(payload.job.summary ?? "Génération terminée.");
        } else if (payload.job.status === "partial") {
          toast.warning(
            payload.job.summary ?? "Génération partielle : des unités ont échoué.",
          );
        } else if (payload.job.status === "cancelled") {
          // Un arrêt n'est pas un échec : il ne mérite ni le rouge, ni
          // « la génération a échoué ».
          toast.message(payload.job.summary ?? "Génération arrêtée.");
        } else {
          toast.error(payload.job.error ?? "La génération a échoué.");
        }
        router.refresh();
      } catch {
        // Un aller-retour raté n'est pas un verdict : le prochain tick réessaie.
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [job?.id, job?.status, router]); // eslint-disable-line react-hooks/exhaustive-deps -- identité du job en primitives

  const launch = useCallback(
    async (phase: ProductionPhase, targetMonth: string) => {
      setLaunching(true);
      try {
        const response = await fetch(`/api/generate/${phase}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: workspaceId, target_month: targetMonth }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          job?: JobPayload;
          error?: string;
        };
        if (!response.ok || !payload.ok || !payload.job) {
          throw new Error(payload.error ?? "Lancement impossible.");
        }
        settledJobId.current = null;
        setJob(payload.job);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Lancement impossible.");
      } finally {
        setLaunching(false);
      }
    },
    [workspaceId],
  );

  /**
   * Arrêt du job en cours.
   *
   * Le verdict revient de la route, pas du sondage : on le pose tout de suite
   * pour que le bouton se libère au clic, et on marque le job comme soldé
   * pour qu'un aller-retour de sondage déjà parti ne fasse pas sonner deux
   * fois la même chose.
   */
  /**
   * « Envoyer en validation » — pas un job : un courriel au client, envoyé
   * depuis la boîte de l'agence, et la phase se clôt sur l'envoi.
   */
  const sendValidation = useCallback(
    async (targetMonth: string) => {
      setLaunching(true);
      try {
        const response = await fetch("/api/production/validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace: slug, target_month: targetMonth }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok: boolean;
          sent?: string[];
          reason?: string;
          error?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(
            payload?.reason ?? payload?.error ?? "Envoi impossible.",
          );
        }

        const count = payload.sent?.length ?? 0;
        toast.success(
          `Planning envoyé en validation à ${count} adresse${count > 1 ? "s" : ""}.`,
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Envoi impossible.");
      } finally {
        setLaunching(false);
      }
    },
    [slug, router],
  );

  const stop = useCallback(async () => {
    if (!job) return;
    setStopping(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/annuler`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        ok: boolean;
        job?: JobPayload;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.job) {
        throw new Error(payload?.error ?? "Arrêt impossible.");
      }
      settledJobId.current = payload.job.id;
      setJob(payload.job);
      if (payload.job.status === "cancelled") {
        toast.message("Génération arrêtée.");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Arrêt impossible.");
    } finally {
      setStopping(false);
    }
  }, [job, router]);

  // La vue du mois travaillé. `views` porte toujours au moins le mois par
  // défaut ; l'index est borné pour survivre à un rafraîchissement serveur qui
  // renverrait moins de vues qu'au rendu précédent.
  const vues = model.views;
  const index = Math.min(moisIndex, vues.length - 1);
  const vue = vues[index]!;
  const multiMois = vues.length > 1;

  const allerAu = (cible: number) => {
    if (cible < 0 || cible >= vues.length || cible === index) return;
    setSens(cible > index ? "suivant" : "precedent");
    setMoisIndex(cible);
  };

  const targetMonthOf = (phase: ProductionPhase): string =>
    vue.segments.find((segment) => segment.phase === phase)?.targetMonth ??
    vue.targetMonth;

  // La barre suit le job en direct quand il tourne, sinon l'avancement des
  // publications du mois calculé côté serveur.
  const progress =
    jobActive && job.total > 0
      ? { done: job.current, total: job.total, label: RUNNING_LABELS[job.phase] }
      : model.progress;

  const ActionIcon = vue.action ? PHASE_ICONS[vue.action.phase] : null;

  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-card">
      {/* --- En-tête ------------------------------------------------------- */}
      <div className="flex items-start gap-3">
        {logoUrl ? (
          /* `contain` et `rounded-md`, jamais un cercle : un logo
             rectangulaire rogné en rond perd son nom. */
          // eslint-disable-next-line @next/next/no-img-element -- URL signée
          <img
            src={logoUrl}
            alt=""
            aria-hidden
            className="mt-0.5 size-8 shrink-0 rounded-md object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="mt-0.5 size-8 shrink-0 rounded-md bg-muted"
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/espace/${slug}`}
            className="type-h3 block truncate text-text-primary hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            {name}
          </Link>
          <p className="type-caption text-text-secondary">{vue.subtitle}</p>
          {vue.lateBadge ? (
            /* Le battement est sur la pastille, jamais sur le texte : une
               opacité qui descend fait passer le libellé sous le seuil de
               contraste la moitié du temps — l'audit navigateur l'a mesuré à
               3,53:1 pour un seuil de 4,5. Le point bat, le mot se lit. */
            <p className="type-caption flex items-center gap-1.5 font-medium text-warning-ink">
              <span
                aria-hidden
                className="anim-retard size-1.5 shrink-0 rounded-pill bg-warning-ink"
              />
              {vue.lateBadge}
            </p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions pour ${name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-[background-color,color] duration-(--motion-duration) ease-standard hover:bg-muted hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none aria-expanded:bg-muted"
          >
            <Ellipsis aria-hidden strokeWidth={1.75} className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {PHASE_ORDER.map((phase) => {
              const Icon = PHASE_ICONS[phase];
              return (
                <DropdownMenuItem
                  key={phase}
                  disabled={jobActive || launching}
                  onClick={() =>
                    phase === "programmation"
                      ? sendValidation(targetMonthOf(phase))
                      : launch(phase, targetMonthOf(phase))
                  }
                >
                  <Icon aria-hidden strokeWidth={1.75} className="size-4" />
                  {MENU_ACTION_LABELS[phase]}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<Link href={`/espace/${slug}/planning`} />}
            >
              Ouvrir le planning éditorial
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/espace/${slug}/contexte`} />}>
              Ouvrir le contexte
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/espace/${slug}`} />}>
              Ouvrir le reporting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* --- Mois travaillé -------------------------------------------------- */}
      {multiMois ? (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-md bg-surface-sunken px-2 py-1.5">
          <span className="type-caption shrink-0 text-text-secondary">Mois travaillé</span>
          <div className="flex min-w-0 items-center gap-0.5">
            {vue.badge ? (
              <span className="type-micro mr-1 shrink-0 rounded-pill bg-info-subtle px-1.5 py-0.5 text-info-ink">
                {vue.badge}
              </span>
            ) : null}
            <button
              type="button"
              aria-label="Mois précédent"
              disabled={index === 0}
              onClick={() => allerAu(index - 1)}
              className="flex size-6 shrink-0 items-center justify-center rounded-sm text-text-secondary transition-[background-color,color] duration-(--motion-duration) ease-standard hover:bg-muted hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
            <span
              key={vue.targetMonth}
              className={cn(
                "type-label min-w-0 truncate px-1 text-center text-text-primary",
                sens === "suivant" ? "anim-mois-suivant" : "anim-mois-precedent",
              )}
            >
              {vue.monthLabel}
            </span>
            <button
              type="button"
              aria-label="Mois suivant"
              disabled={index === vues.length - 1}
              onClick={() => allerAu(index + 1)}
              className="flex size-6 shrink-0 items-center justify-center rounded-sm text-text-secondary transition-[background-color,color] duration-(--motion-duration) ease-standard hover:bg-muted hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* --- Barre de phases ------------------------------------------------ */}
      {/* Deux grilles de quatre colonnes égales, jamais deux `flex` : c'est ce
          qui garantit qu'un libellé tombe exactement sous son segment. Avec
          `justify-between`, « Programmation » dérivait d'un demi-segment.
          La clé porte le mois : changer de mois rejoue la glissade. */}
      <div
        key={vue.targetMonth}
        className={cn(
          multiMois ? "mt-3" : "mt-4",
          multiMois && (sens === "suivant" ? "anim-mois-suivant" : "anim-mois-precedent"),
        )}
      >
        <div className="grid grid-cols-4 gap-1">
          {vue.segments.map((segment) => (
            <span
              key={segment.phase}
              aria-hidden
              className={cn(
                "h-1 rounded-pill",
                TONE_BG[segment.tone],
                // Seule une phase réellement en retard bat : l'ambre d'une
                // fenêtre simplement ouverte ne doit pas crier.
                segment.late && "anim-retard",
              )}
            />
          ))}
        </div>
        <p className="sr-only">{`Cycle du mois : ${vue.subtitle}`}</p>
        {/* Pas de gouttière sur cette rangée : « Programmation » a besoin de
            toute la colonne. `truncate` reste en filet de sécurité pour les
            cartes plus étroites que la grille à trois colonnes. */}
        <div className="mt-1.5 grid grid-cols-4">
          {vue.segments.map((segment) => (
            <span
              key={segment.phase}
              className={cn(
                "type-micro truncate text-center",
                segment.isCurrent
                  ? "font-medium text-text-primary"
                  : "text-text-secondary",
              )}
            >
              {PHASE_LABELS[segment.phase]}
            </span>
          ))}
        </div>

        {/* --- Mesures de la phase ------------------------------------------ */}
        <dl className="mt-4 space-y-1.5">
          {vue.metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between gap-2">
              <dt className="type-caption min-w-0 truncate text-text-secondary">
                {metric.label}
              </dt>
              <dd className="type-label text-text-primary tabular-nums">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* --- Avancement des publications du mois ----------------------------- */}
      {progress && progress.total > 0 ? (
        <div className="mt-4">
          <div className="type-caption mb-1.5 flex items-center justify-between gap-2 text-text-secondary">
            <span className="min-w-0 truncate">{progress.label}</span>
            <span className="shrink-0 tabular-nums">
              {progress.done} sur {progress.total}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label={`${progress.label} : ${progress.done} sur ${progress.total}`}
            className="h-1 overflow-hidden rounded-pill bg-surface-sunken"
          >
            <div
              className="h-full rounded-pill bg-brand transition-[width]"
              style={{
                width: `${Math.round((progress.done / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* --- Encart contextuel ----------------------------------------------- */}
      {vue.info ? (
        <div className="mt-4 rounded-md bg-surface-sunken p-3 type-caption text-text-secondary">
          {vue.info}
        </div>
      ) : null}

      {/* --- Action principale ------------------------------------------------ */}
      {jobActive ? (
        /* Le témoin d'avancement n'est pas cliquable ; c'est « Arrêter » qui
           porte la seule sortie possible tant que le job tient la carte. */
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="sm" className="min-w-0 flex-1" disabled>
            <Loader2 aria-hidden className="animate-spin" strokeWidth={1.75} />
            <span className="truncate">
              {RUNNING_LABELS[job.phase]}
              {job.total > 0 ? ` · ${job.current}/${job.total}` : null}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-danger-ink/35 text-danger-ink hover:border-danger-ink/60 hover:bg-danger-subtle/40"
            disabled={stopping}
            onClick={stop}
          >
            {stopping ? (
              <Loader2 aria-hidden className="animate-spin" strokeWidth={1.75} />
            ) : (
              <CircleStop aria-hidden strokeWidth={1.75} />
            )}
            Arrêter
          </Button>
        </div>
      ) : vue.action ? (
        <Button
          variant={vue.action.kind === "resume" ? "destructive" : "outline"}
          size="sm"
          className={cn(
            "mt-4 w-full",
            vue.action.kind !== "resume" &&
              "border-accent-ink/35 text-accent-ink hover:border-accent-ink/60 hover:bg-accent-subtle/40",
          )}
          disabled={vue.action.disabled || launching}
          title={vue.action.reason ?? undefined}
          onClick={() =>
            vue.action!.kind === "validation"
              ? sendValidation(vue.action!.targetMonth)
              : launch(vue.action!.phase, vue.action!.targetMonth)
          }
        >
          {launching ? (
            <Loader2 aria-hidden className="animate-spin" strokeWidth={1.75} />
          ) : ActionIcon ? (
            <ActionIcon aria-hidden strokeWidth={1.75} />
          ) : null}
          {vue.action.label}
        </Button>
      ) : null}
    </article>
  );
}

/** Les actions du menu, sans compteur : elles restent lisibles à tout moment. */
const MENU_ACTION_LABELS: Record<ProductionPhase, string> = {
  intentions: "Générer les intentions",
  wording: "Rédiger les wordings",
  programmation: "Envoyer en validation",
  reporting: "Générer le reporting",
};
