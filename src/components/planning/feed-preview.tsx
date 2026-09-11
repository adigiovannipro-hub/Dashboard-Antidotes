"use client";

import { useEffect, useState } from "react";
import { Grid3x3, ImageOff, Images, Play, X } from "lucide-react";

import { BodyPortal } from "@/components/planning/body-portal";
import { useDismissOnOutsideClick } from "@/components/planning/panel-layers";
import { buildFeed, feedSummary, type FeedTile } from "@/lib/planning/feed";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import type { MonthWithLanes, ResolvedVisual } from "@/lib/planning/types";
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
  zIndex,
  onOpenSubject,
  onClose,
}: {
  months: MonthWithLanes[];
  monthKey: string;
  /** La vitrine du compte branché, quand il y en a un. */
  profile: InstagramProfile | null;
  workspaceName: string;
  /** Rang d'empilement : le dernier panneau demandé passe devant. */
  zIndex: number;
  /** Le clic sur une case ouvre la publication, par-dessus la grille. */
  onOpenSubject: (subjectId: string) => void;
  onClose: () => void;
}) {
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const tiles = buildFeed(months, monthKey);
  // Le compteur ne parle que du mois visé : l'antériorité est un décor.
  const { total, missing } = feedSummary(tiles.filter((tile) => !tile.previous));

  // Un clic sur le tableau derrière referme : c'est la sortie qu'on cherche
  // sans réfléchir, avant même la croix.
  useDismissOnOutsideClick(true, onClose);

  // Échap ferme, comme partout ailleurs dans le planning.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <BodyPortal>
    <aside
      aria-label={`Prévisualisation du feed à fin ${monthGroupLabel(monthKey)}`}
      data-panel
      style={{ zIndex }}
      className="border-border bg-background animate-in slide-in-from-right fixed inset-y-0 right-0 flex w-full max-w-md flex-col border-l shadow-xl duration-300 motion-reduce:animate-none"
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
            {/* Un gramme d'espace entre les cases, comme sur le profil. Le
                fond blanc n'est pas décoratif : le panneau est gris, et une
                case manquante — grise elle aussi — s'y confondrait. Sur blanc,
                le trou se voit, ce qui est tout l'intérêt de la grille. */}
            <div className="bg-surface grid grid-cols-3 gap-0.5 px-0.5">
              {tiles.map((tile) => (
                <FeedCell
                  key={tile.subject.id}
                  tile={tile}
                  ratio={ratio}
                  onOpen={() => onOpenSubject(tile.subject.id)}
                />
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
    </BodyPortal>
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
  /* Une URL du CDN Instagram est signée et datée : périmée, l'image ne charge
     pas et le repli initiales ne se déclenchait pas — `avatar_url` n'est pas
     `null` pour autant. On garde l'URL fautive, pas un booléen, pour qu'une
     photo réécrite au passage suivant retrouve sa chance. */
  const [avatarCasse, setAvatarCasse] = useState<string | null>(null);

  return (
    <div className="border-border border-b px-4 py-4">
      <div className="flex items-center gap-4">
        {profile?.avatar_url && profile.avatar_url !== avatarCasse ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN Instagram
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setAvatarCasse(profile.avatar_url)}
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
 * Le média d'une case : la miniature quand elle existe — une image légère là
 * où chaque reel de la grille téléchargeait son amorce vidéo — sinon
 * l'original, et `#t=0.1` tire la première image d'une vidéo d'avant la
 * convention, sans extraction serveur.
 */
function CoverMedia({
  cover,
  isVideo,
  alt,
}: {
  cover: ResolvedVisual;
  isVideo: boolean;
  alt: string;
}) {
  if (cover.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL signée
      <img
        src={cover.previewUrl}
        alt={alt}
        loading="lazy"
        className="size-full object-cover"
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={`${cover.url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        className="size-full object-cover"
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL signée
    <img
      src={cover.url}
      alt={alt}
      loading="lazy"
      className="size-full object-cover"
    />
  );
}

/** Une case de la grille. */
function FeedCell({
  tile,
  ratio,
  onOpen,
}: {
  tile: FeedTile;
  ratio: Ratio;
  onOpen: () => void;
}) {
  const { subject, cover, isVideo } = tile;
  const date = subject.scheduled_on
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${subject.scheduled_on}T00:00:00Z`))
    : "sans date";

  // Une case d'un mois passé donne le contexte du profil, rien de plus : le
  // visuel seul, sans clic, sans date, sans survol — ce n'est plus un
  // travail, c'est le décor sous le mois qu'on prépare.
  if (tile.previous) {
    return (
      <div
        aria-hidden
        className={cn(
          "bg-canvas relative overflow-hidden opacity-90",
          ratio === "4:5" ? "aspect-4/5" : "aspect-square",
        )}
      >
        {cover ? <CoverMedia cover={cover} isVideo={isVideo} alt="" /> : null}
      </div>
    );
  }

  return (
    // Un bouton et non un `div` : la case ouvre la publication, elle doit
    // s'atteindre au clavier comme à la souris.
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ouvrir ${subject.name || "la publication"} du ${date}`}
      className={cn(
        // Le gris de fond sert aussi de filet : une créa qui charge encore, ou
        // une vidéo dont le navigateur ne sait pas tirer la première image,
        // laisse une case grise et non un trou blanc.
        "group/cell bg-canvas focus-visible:ring-brand relative overflow-hidden outline-none focus-visible:z-10 focus-visible:ring-2",
        ratio === "4:5" ? "aspect-4/5" : "aspect-square",
      )}
      title={`${subject.name || "Sans sujet"} — ${date}`}
    >
      {cover === null ? (
        // La case grise : c'est le trou qu'on vient chercher des yeux. Elle
        // doit donc se voir — un gris trop clair la ferait disparaître dans le
        // panneau blanc, et la grille mentirait par omission.
        <span className="bg-canvas border-border-strong flex size-full flex-col items-center justify-center gap-1 border border-dashed">
          <ImageOff
            className="text-text-tertiary size-5"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="text-text-secondary px-1 text-center text-[10px] leading-tight">
            {date}
          </span>
        </span>
      ) : (
        <CoverMedia cover={cover} isVideo={isVideo} alt={subject.name} />
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
    </button>
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
