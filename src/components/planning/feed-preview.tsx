"use client";

import { useEffect, useState } from "react";
import { Grid3x3, ImageOff, Images, Play, X } from "lucide-react";

import { buildFeed, feedSummary, type FeedTile } from "@/lib/planning/feed";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import type { MonthWithLanes } from "@/lib/planning/types";
import type { InstagramProfile } from "@/lib/social/types";
import { cn } from "@/lib/utils";

/**
 * La prévisualisation du feed Instagram — à quoi ressemblera le profil du
 * client à la fin du mois choisi.
 *
 * On y vient pour deux questions : « est-ce que ça se tient visuellement ? »
 * et « où manque-t-il encore une créa ? ». La grille répond aux deux d'un coup
 * d'œil, et c'est pour ça qu'un sujet sans visuel garde sa case, en gris, au
 * lieu de disparaître.
 */

/** Le profil affiche la grille en 4:5 depuis la refonte d'Instagram ; le carré
    reste disponible pour qui prépare encore des visuels 1:1. */
type Ratio = "4:5" | "1:1";

export function FeedPreview({
  months,
  monthKey,
  profile,
  workspaceName,
  onClose,
}: {
  months: MonthWithLanes[];
  monthKey: string;
  /** La vitrine du compte branché, quand il y en a un. */
  profile: InstagramProfile | null;
  workspaceName: string;
  onClose: () => void;
}) {
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const tiles = buildFeed(months, monthKey);
  const { total, missing } = feedSummary(tiles);

  // Échap ferme, comme partout ailleurs dans le planning.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      aria-label={`Prévisualisation du feed à fin ${monthGroupLabel(monthKey)}`}
      className="border-border bg-background animate-in slide-in-from-right fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l shadow-xl duration-300 motion-reduce:animate-none"
    >
      <header className="border-border flex items-center gap-3 border-b p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la prévisualisation"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-brand rounded-md p-1.5 outline-none focus-visible:ring-2"
        >
          <X className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="type-overline text-text-secondary">Feed Instagram</p>
          <p className="truncate text-sm font-semibold">
            à fin {monthGroupLabel(monthKey)}
          </p>
        </div>

        <RatioToggle ratio={ratio} onChange={setRatio} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProfileHeader
          profile={profile}
          workspaceName={workspaceName}
          plannedCount={total}
        />

        {tiles.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            Rien à montrer : aucune publication datée jusqu&apos;à la fin de ce
            mois.
          </p>
        ) : (
          <>
            {/* Un gramme d'espace entre les cases, comme sur le profil. */}
            <div className="grid grid-cols-3 gap-0.5 px-0.5">
              {tiles.map((tile) => (
                <FeedCell key={tile.subject.id} tile={tile} ratio={ratio} />
              ))}
            </div>

            <p className="text-muted-foreground px-4 py-3 text-center text-xs">
              {total} publication{total > 1 ? "s" : ""} dans la grille
              {missing > 0 ? (
                <>
                  {" · "}
                  <span className="text-warning-ink font-medium">
                    {missing} sans visuel
                  </span>
                </>
              ) : null}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function RatioToggle({
  ratio,
  onChange,
}: {
  ratio: Ratio;
  onChange: (next: Ratio) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Format des cases"
      className="border-border flex shrink-0 overflow-hidden rounded-md border"
    >
      {(["4:5", "1:1"] as const).map((candidate) => (
        <button
          key={candidate}
          type="button"
          onClick={() => onChange(candidate)}
          aria-pressed={ratio === candidate}
          className={cn(
            "px-2 py-1 text-[11px] tabular-nums transition-colors",
            ratio === candidate
              ? "bg-foreground text-background font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}

/**
 * L'en-tête du profil.
 *
 * Avec un compte branché, ce sont ses vraies informations — photo, bio,
 * abonnés — lues par l'API au moment du branchement. Sans compte, un en-tête
 * neutre au nom de l'espace : la grille reste utile, et rien n'est inventé.
 */
function ProfileHeader({
  profile,
  workspaceName,
  plannedCount,
}: {
  profile: InstagramProfile | null;
  workspaceName: string;
  plannedCount: number;
}) {
  const publishedCount = profile?.media_count ?? null;

  return (
    <div className="border-border border-b px-4 py-4">
      <div className="flex items-center gap-4">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN Instagram
          <img
            src={profile.avatar_url}
            alt=""
            className="size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          >
            {workspaceName.slice(0, 1).toUpperCase()}
          </span>
        )}

        <dl className="grid flex-1 grid-cols-3 gap-1 text-center">
          <Stat
            value={
              publishedCount === null
                ? plannedCount
                : publishedCount + plannedCount
            }
            label="publications"
          />
          <Stat value={profile?.followers_count ?? null} label="abonnés" />
          <Stat value={null} label="suivis" />
        </dl>
      </div>

      <p className="mt-3 text-sm font-semibold">
        {profile?.display_name ?? workspaceName}
      </p>
      {profile?.username ? (
        <p className="text-muted-foreground text-xs">{profile.username}</p>
      ) : null}
      {profile?.biography ? (
        <p className="mt-1 text-xs whitespace-pre-line">{profile.biography}</p>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">
          Compte Instagram non branché — photo, bio et abonnés apparaîtront ici
          une fois la connexion faite.
        </p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <dd className="text-sm font-semibold tabular-nums">
        {value === null ? "—" : new Intl.NumberFormat("fr-FR").format(value)}
      </dd>
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
    </div>
  );
}

/**
 * Une case de la grille.
 *
 * Pour une vidéo, `#t=0.1` demande au navigateur la première image sans lire
 * la vidéo : c'est la vignette d'Instagram, obtenue sans extraction ni
 * traitement côté serveur.
 */
function FeedCell({ tile, ratio }: { tile: FeedTile; ratio: Ratio }) {
  const { subject, cover, isVideo } = tile;
  const date = subject.scheduled_on
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${subject.scheduled_on}T00:00:00Z`))
    : "sans date";

  return (
    <div
      className={cn(
        "group/cell bg-muted relative overflow-hidden",
        ratio === "4:5" ? "aspect-4/5" : "aspect-square",
      )}
      title={`${subject.name || "Sans sujet"} — ${date}`}
    >
      {cover === null ? (
        // La case grise : c'est le trou qu'on vient chercher des yeux. Elle
        // doit donc se voir — un gris trop clair la ferait disparaître dans le
        // panneau blanc, et la grille mentirait par omission.
        <span className="bg-surface-sunken border-border flex size-full flex-col items-center justify-center gap-1 border border-dashed">
          <ImageOff
            className="text-text-tertiary size-5"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="text-text-secondary px-1 text-center text-[10px] leading-tight">
            {date}
          </span>
        </span>
      ) : isVideo ? (
        <video
          src={`${cover.url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className="size-full object-cover"
        >
          <track kind="captions" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée
        <img
          src={cover.url}
          alt={subject.name}
          loading="lazy"
          className="size-full object-cover"
        />
      )}

      {/* Les repères d'Instagram : l'icône Reel, l'icône carrousel. */}
      {isVideo ? (
        <Play
          className="absolute top-1.5 right-1.5 size-3.5 fill-white text-white drop-shadow"
          aria-label="Vidéo"
        />
      ) : subject.visuals.length > 1 ? (
        <Images
          className="absolute top-1.5 right-1.5 size-3.5 text-white drop-shadow"
          aria-label="Carrousel"
        />
      ) : null}

      {/* Au survol : de quoi reconnaître la publication sans quitter la grille. */}
      {/* Le voile doit tenir sur n'importe quelle créa, y compris blanche :
          d'où l'aplat presque opaque plutôt qu'un simple dégradé. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent px-1.5 pt-5 pb-1 text-[10px] leading-tight text-white opacity-0 transition-opacity group-hover/cell:opacity-100">
        <span className="line-clamp-2 drop-shadow">{subject.name || "Sans sujet"}</span>
        <span className="drop-shadow">{date}</span>
      </span>
    </div>
  );
}

/** Le bouton posé à côté de chaque mois. */
export function FeedPreviewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Prévisualiser le feed Instagram à la fin de ce mois"
      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <Grid3x3 className="size-3.5" strokeWidth={1.75} aria-hidden />
      Feed
    </button>
  );
}
