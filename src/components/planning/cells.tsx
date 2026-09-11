"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, Loader2, Paperclip, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { PlanningResult } from "@/app/actions/planning";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import { VisualLightbox } from "@/components/planning/lightbox";
import { GenerateWordingButton } from "@/components/planning/wording-generation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPlainNumber } from "@/lib/format";
import type { PlanningOwner, ResolvedVisual } from "@/lib/planning/types";
import { visualThumbUrl } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Cellules éditables du tableau.
 *
 * Chaque cellule écrit directement en base, sans bouton « enregistrer » : c'est
 * ce qu'on attend d'un tableur, et c'est ce que fait Monday. Les champs texte
 * n'envoient qu'à la sortie du champ, et seulement si la valeur a changé —
 * sinon un simple passage au clavier déclencherait une écriture par colonne.
 */

/**
 * Lance une action et signale l'échec. Le succès, lui, se voit à l'écran —
 * sauf quand l'action a quelque chose à dire (« envoyé à… », « 3 dupliquées »),
 * auquel cas son message passe en toast.
 */
export function useCellAction() {
  const [pending, startTransition] = useTransition();

  /**
   * Rend le verdict à qui le demande.
   *
   * `run` ne rendait rien. Les appelants qui affichent un état par avance —
   * la pastille de statut, qui prend sa nouvelle couleur au clic — n'avaient
   * alors aucun moyen de savoir qu'il fallait revenir en arrière : en cas
   * d'échec, le serveur ne revalide pas, la valeur d'origine ne redescend
   * jamais, et la cellule mentait jusqu'au prochain rechargement.
   *
   * La promesse aboutit toujours — jamais de rejet : un appelant qui ignore le
   * retour, ce que font la quasi-totalité des cellules, ne doit pas provoquer
   * un « unhandled rejection ».
   */
  const run = (action: () => Promise<PlanningResult>): Promise<PlanningResult> =>
    new Promise((resolve) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (!result.ok) toast.error(result.error);
          else if (result.message) toast.success(result.message);
          resolve(result);
        } catch {
          // Un envoi refusé par le serveur (vidéo au-delà de la limite, réseau
          // coupé) jetterait sinon jusqu'à l'écran d'erreur du navigateur — la
          // « page buggée ». Ici : un toast, et la page reste debout.
          const message =
            "L'action n'a pas abouti — fichier trop lourd ou connexion interrompue.";
          toast.error(message);
          resolve({ ok: false, error: message });
        }
      });
    });

  return { run, pending };
}

export function CellSpinner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Loader2
      className="text-muted-foreground size-3 shrink-0 animate-spin"
      aria-label="Enregistrement"
    />
  );
}

// --- Texte -------------------------------------------------------------------

export function TextCell({
  value,
  onCommit,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);

  // Une écriture venue d'ailleurs — revalidation, autre onglet — doit reprendre
  // la main. Pas pendant qu'on tape, en revanche : `draft === synced` dit
  // précisément que le champ n'a pas été touché depuis la dernière écriture.
  if (value !== synced && draft === synced) {
    setSynced(value);
    setDraft(value);
  }

  function commit() {
    const next = draft.trim();
    if (next === synced) return;
    setSynced(next);
    onCommit(next);
  }

  return (
    <input
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(synced);
          event.currentTarget.blur();
        }
      }}
      className={cn(
        "focus-visible:ring-brand w-full rounded-sm bg-transparent px-1.5 py-1 text-sm outline-none focus-visible:ring-2",
        className,
      )}
    />
  );
}

export function NumberCell({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
  ariaLabel: string;
}) {
  const incoming = value === null ? "" : String(value);
  const [draft, setDraft] = useState(incoming);
  const [synced, setSynced] = useState(incoming);
  // Au repos la cellule montre le nombre mis en forme (« 1 200 ») ; dès qu'on
  // y entre, elle rend la saisie brute — un séparateur de milliers dans un
  // champ qu'on est en train de taper se retourne contre l'utilisateur.
  const [editing, setEditing] = useState(false);

  if (incoming !== synced && draft === synced) {
    setSynced(incoming);
    setDraft(incoming);
  }

  function commit() {
    if (draft === synced) return;
    setSynced(draft);
    const trimmed = draft.trim().replace(",", ".");
    if (trimmed === "") return onCommit(null);
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Montant invalide.");
      setDraft(value === null ? "" : String(value));
      return;
    }
    onCommit(parsed);
  }

  const parsedDraft = Number(draft.trim().replace(",", "."));
  const display =
    editing || draft.trim() === "" || !Number.isFinite(parsedDraft)
      ? draft
      : formatPlainNumber(parsedDraft);

  return (
    <input
      inputMode="decimal"
      value={display}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="focus-visible:ring-brand w-full rounded-sm bg-transparent px-1.5 py-1 text-right text-sm tabular-nums outline-none focus-visible:ring-2"
    />
  );
}

/**
 * Cellule date : toute la surface ouvre le calendrier — l'icône comme les
 * chiffres. L'input natif reste dans le flux mais invisible ; le bouton
 * au-dessus porte l'affichage et déclenche `showPicker()`.
 *
 * Re-cliquer la cellule **referme** le calendrier. Le picker natif ne dit
 * jamais qu'il se ferme ; mais il se ferme de lui-même sur le `pointerdown`
 * qui précède notre `click` — sans garde, le `click` le rouvrait aussitôt et
 * le calendrier semblait incollable. On note donc qu'il est ouvert, et un
 * `pointerdown` sur la cellule pendant ce temps fait sauter la réouverture.
 */
export function DateCell({
  value,
  onCommit,
  late,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
  /** En retard — la date s'encre en rouge, sur « Mon travail ». */
  late?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const skipReopen = useRef(false);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        wrapRef.current?.contains(event.target)
      ) {
        skipReopen.current = true;
      }
      setPickerOpen(false);
    };
    // En capture : le picker natif est déjà fermé quand ce geste atteint la
    // page, l'état doit suivre quel que soit l'endroit cliqué.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [pickerOpen]);

  const display = value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${value}T00:00:00Z`))
    : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        ref={inputRef}
        type="date"
        value={value ?? ""}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          onCommit(event.target.value || null);
          setPickerOpen(false);
        }}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
      <button
        type="button"
        aria-label={display ? `Date : ${display}${late ? " (en retard)" : ""}` : "Choisir une date"}
        onClick={() => {
          if (skipReopen.current) {
            skipReopen.current = false;
            return;
          }
          const input = inputRef.current;
          if (!input) return;
          if ("showPicker" in input) input.showPicker();
          else (input as HTMLInputElement).click();
          setPickerOpen(true);
        }}
        className="hover:bg-muted/60 focus-visible:ring-brand flex h-7 w-full items-center justify-center gap-1.5 rounded-sm px-1.5 text-sm tabular-nums outline-none focus-visible:ring-2"
      >
        <CalendarDays
          className={cn("size-3.5 shrink-0", late ? "text-danger-ink" : "text-muted-foreground")}
          aria-hidden
        />
        <span
          className={cn(
            !display && "text-muted-foreground",
            late && "text-danger-ink font-semibold",
          )}
        >
          {display ?? "—"}
        </span>
      </button>
    </div>
  );
}

/** Case à cocher — la colonne « OK » de Monday. */
export function CheckboxCell({
  checked,
  label,
  onCommit,
}: {
  checked: boolean;
  label: string;
  onCommit: (next: boolean) => void;
}) {
  return (
    <label className="flex h-7 w-full cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onCommit(event.target.checked)}
        className="accent-brand size-4"
      />
    </label>
  );
}

/** La colonne Last update : qui, quand — le libellé est calculé côté serveur. */
export function LastUpdateCell({
  updater,
  label,
}: {
  updater: PlanningOwner | null;
  label: string;
}) {
  return (
    <span className="flex items-center justify-center gap-1.5">
      <OwnerAvatar owner={updater} />
      <span className="text-muted-foreground truncate text-xs">{label}</span>
    </span>
  );
}

// --- Pastilles ----------------------------------------------------------------

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  color: string;
};

const INK_DARK = "#1a1a1a";
const INK_LIGHT = "#ffffff";

/** Luminance relative WCAG d'un `#rrggbb`, `null` si la chaîne n'en est pas un. */
function relativeLuminance(color: string): number | null {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * L'encre d'une pastille, déduite de son fond.
 *
 * Les couleurs viennent du board Monday et ne se négocient pas — mais du blanc
 * posé sur « EN BROUILLON » (#9cd326) tombe à 1,79:1, illisible. Plutôt que de
 * retoucher la palette du client, on choisit l'encre.
 *
 * On **compare les deux contrastes** au lieu de trancher sur un seuil de
 * luminance. Le seuil qui vivait ici, 0,45, était mal calé : la bascule réelle
 * est vers 0,20, et tout ce qui tombait entre les deux recevait du blanc alors
 * que le sombre était meilleur. « PUBLIÉ » (#00c875) sortait ainsi à 2,21:1 au
 * lieu de 7,88:1, et « WORDING À FAIRE » (#ff6d3b) à 2,82:1 au lieu de 6,19:1.
 * Un calcul ne se dérègle pas ; une constante, si.
 *
 * Exporté : les étiquettes de thème de la FAQ suivent la même règle, et un
 * second calcul d'encre finirait par diverger de celui-ci.
 */
export function chipInk(color: string): string {
  const background = relativeLuminance(color);
  if (background === null) return INK_LIGHT;

  const contrast = (ink: number) =>
    ink > background
      ? (ink + 0.05) / (background + 0.05)
      : (background + 0.05) / (ink + 0.05);

  const dark = relativeLuminance(INK_DARK) ?? 0;
  return contrast(dark) >= contrast(1) ? INK_DARK : INK_LIGHT;
}

/**
 * Pastille colorée avec sélecteur, à la manière des colonnes « status » de
 * Monday. Les couleurs sont celles du board d'origine : l'équipe les lit depuis
 * des mois, et un orange qui ne veut plus dire « en cours » coûterait plus cher
 * qu'une palette repensée.
 */
export function ChipSelect<T extends string>({
  value,
  options,
  onSelect,
  ariaLabel,
  allowClear,
  placeholder,
  className,
  onEditLabels,
  fill,
}: {
  value: T | null;
  options: ChipOption<T>[];
  /**
   * `unknown` en retour, et non `void` : les appelants rendent des choses
   * différentes — la promesse de `useCellAction.run`, ou le résultat d'un
   * `next && apply(…)` qui vaut la chaîne vide quand rien n'est choisi. Seul
   * compte le fait qu'une promesse, s'il y en a une, soit attendue : c'est
   * elle qui borne l'affichage par avance de la couleur choisie.
   */
  onSelect: (next: T | null) => unknown;
  ariaLabel: string;
  allowClear?: boolean;
  /** Affiché sans valeur — le nom de l'action dans la barre groupée. */
  placeholder?: string;
  className?: string;
  /** Ouvre l'éditeur d'étiquettes de la colonne — le « + Nouvelle étiquette »
      accessible depuis le sélecteur lui-même, comme sur Monday. */
  onEditLabels?: () => void;
  /** Dans une cellule du tableau : l'aplat remplit **tout** le rectangle,
      bord à bord et sans arrondi — la case entière est colorée, comme sur
      Monday. Ailleurs (panneau, barre groupée), la pastille garde sa forme. */
  fill?: boolean;
}) {
  // Contrôlé : les options sont des boutons libres (la grille colorée), pas
  // des items de menu — sans ça, choisir une pastille laissait le menu ouvert.
  const [open, setOpen] = useState(false);

  /**
   * La couleur choisie, affichée **avant** que le serveur ne réponde.
   *
   * C'est le défaut le plus visible du board : passer une publication de
   * « À VALIDER » à « PUBLIÉ » écrivait en base, revalidait la page, et la
   * pastille ne changeait de couleur qu'au retour — d'un tiers de seconde à
   * plus d'une seconde sur une ligne chargée. Pendant tout ce temps, l'écran
   * affirme que rien n'a été choisi. On reclique, et on écrit deux fois.
   *
   * `useOptimistic` plutôt qu'un `useState` local, et la raison est le cas
   * d'échec : React garde la valeur affichée exactement le temps de la
   * transition, puis **revient de lui-même** à la valeur du serveur. Un état
   * local, lui, devait deviner quand se rétracter — trop tôt, la pastille
   * clignote entre l'ancienne et la nouvelle couleur ; trop tard, elle ment.
   * C'est aussi ce qui rend la barre d'actions groupées correcte sans un mot
   * de plus : son sélecteur affiche le libellé choisi pendant l'écriture, puis
   * retrouve son intitulé, sa valeur restant `null` de bout en bout.
   */
  const [shown, showChoice] = useOptimistic(value);
  const [, startPick] = useTransition();

  const current = options.find((option) => option.value === shown) ?? null;

  const pick = (next: T | null) => {
    setOpen(false);
    startPick(async () => {
      // Avant tout `await` : un état optimiste ne se pose que dans la partie
      // synchrone d'une transition.
      showChoice(next);
      await onSelect(next);
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          // La transition de couleur n'est pas un ornement : la pastille prend
          // sa nouvelle teinte au clic, et un aplat qui saute d'un vert à un
          // orange se lit comme un défaut d'affichage. Cent cinquante
          // millisecondes suffisent à en faire un changement d'état.
          "focus-visible:ring-brand flex w-full items-center justify-center px-2 text-[11px] font-semibold tracking-wide uppercase outline-none transition-[background-color,color] duration-(--motion-duration) ease-standard focus-visible:ring-2 motion-reduce:transition-none",
          // L'anneau de focus passe à l'intérieur quand l'aplat touche les
          // bords : dessiné dehors, il disparaîtrait sous les cellules
          // voisines.
          fill
            ? "h-full min-h-9 rounded-none focus-visible:ring-inset"
            : "h-7 rounded-sm",
          className,
        )}
        style={{
          backgroundColor: current?.color ?? "transparent",
          color: current ? chipInk(current.color) : undefined,
        }}
      >
        <span className={cn("truncate", !current && "text-muted-foreground")}>
          {current?.label ?? placeholder ?? "—"}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 min-w-56 p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => pick(option.value)}
              className="focus-visible:ring-ring flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold tracking-wide uppercase outline-none focus-visible:ring-2"
              style={{ backgroundColor: option.color, color: chipInk(option.color) }}
            >
              <span className="truncate">{option.label}</span>
              {option.value === shown ? (
                <Check className="ml-1 size-3 shrink-0" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
        {allowClear ? (
          <DropdownMenuItem onClick={() => pick(null)} className="mt-1">
            Vider
          </DropdownMenuItem>
        ) : null}
        {onEditLabels ? (
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              onEditLabels();
            }}
            className={allowClear ? undefined : "mt-1"}
          >
            <Pencil className="size-3.5" aria-hidden />
            Modifier les étiquettes…
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sélecteur textuel sans couleur — les objectifs publicitaires. */
export function TextSelect({
  value,
  options,
  onSelect,
  ariaLabel,
}: {
  value: string | null;
  options: string[];
  onSelect: (next: string | null) => void;
  ariaLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="hover:bg-muted/60 focus-visible:ring-brand flex h-7 w-full items-center rounded-sm px-1.5 text-left text-sm outline-none focus-visible:ring-2"
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ?? "—"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 min-w-48">
        {options.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onSelect(option)}>
            {option}
            {option === value ? <Check className="ml-auto size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onSelect(null)}>Vider</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Propriétaire ---------------------------------------------------------------

export function OwnerCell({
  owner,
  candidates,
  onSelect,
}: {
  owner: PlanningOwner | null;
  candidates: PlanningOwner[];
  onSelect: (ownerId: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Propriétaire"
        className="focus-visible:ring-brand flex w-full items-center justify-center rounded-sm outline-none focus-visible:ring-2"
      >
        <OwnerAvatar owner={owner} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 min-w-56">
        {candidates.length === 0 ? (
          <DropdownMenuItem disabled>Aucun compte disponible</DropdownMenuItem>
        ) : null}
        {candidates.map((candidate) => (
          <DropdownMenuItem
            key={candidate.id}
            onClick={() => onSelect(candidate.id)}
            className="gap-2"
          >
            <OwnerAvatar owner={candidate} />
            <span className="truncate">
              {candidate.full_name ?? candidate.email}
            </span>
            {candidate.id === owner?.id ? (
              <Check className="ml-auto size-3.5" />
            ) : null}
          </DropdownMenuItem>
        ))}
        {owner ? (
          <DropdownMenuItem onClick={() => onSelect(null)}>Retirer</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OwnerAvatar({ owner }: { owner: PlanningOwner | null }) {
  if (!owner) {
    return (
      <span
        aria-hidden
        className="border-border text-muted-foreground flex size-6 items-center justify-center rounded-full border border-dashed text-[10px]"
      >
        ?
      </span>
    );
  }

  const label = owner.full_name ?? owner.email;
  const initials = label
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <Avatar className="size-6" title={label}>
      {owner.avatar_url ? <AvatarImage src={owner.avatar_url} alt={label} /> : null}
      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
    </Avatar>
  );
}

// --- Wording ---------------------------------------------------------------------

/** Position d'un flottant ancré à la cellule : vers le bas, ou vers le haut
    quand le bas de l'écran est trop proche. */
type AnchoredBox = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
};

function anchorBox(rect: DOMRect, minWidth: number, reserve: number): AnchoredBox {
  const up = rect.top > window.innerHeight - reserve;
  return {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8)),
    width: Math.max(rect.width, minWidth),
    ...(up
      ? { bottom: window.innerHeight - rect.bottom }
      : { top: rect.top }),
  };
}

/**
 * La cellule Wording, à la Monday : le texte tient sur une ligne au repos,
 * le survol montre le texte entier en infobulle, et le clic **agrandit la
 * cellule sur place** — un cadre d'édition posé par-dessus le tableau, pas
 * une boîte de dialogue. Sortir du cadre enregistre, Échap annule.
 *
 * Le cadre et l'infobulle sont en `position: fixed` : la cellule vit dans un
 * conteneur qui défile (`overflow-x-auto`), où un `absolute` serait rogné dès
 * la dernière ligne du couloir.
 */
export function WordingCell({
  value,
  subjectName,
  onCommit,
  generateSubjectId,
  fieldName,
  placeholder,
  readOnly,
  align = "center",
}: {
  value: string | null;
  subjectName: string;
  onCommit: (next: string | null) => void;
  /** Posé par l'agence seulement : le stylo de génération apparaît au survol. */
  generateSubjectId?: string;
  /** Ce que la cellule contient — « Wording » par défaut, « Réponse » dans la
      FAQ : c'est ce que le lecteur d'écran annonce. */
  fieldName?: string;
  placeholder?: string;
  /** Le client lit la FAQ sans la réécrire : la bulle de survol reste, le
      cadre d'édition ne s'ouvre pas. */
  readOnly?: boolean;
  /** Le texte au repos. Centré par défaut — la colonne Wording du planning
      l'est depuis toujours ; à gauche dans la FAQ, dont les en-têtes le sont
      et dont les cellules se lisent en colonne. */
  align?: "left" | "center";
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [editor, setEditor] = useState<AnchoredBox | null>(null);
  const [draft, setDraft] = useState("");
  const [tip, setTip] = useState<AnchoredBox | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    if (tipCloseTimer.current) clearTimeout(tipCloseTimer.current);
    setTip(null);
  };

  // La bulle survit au passage de la souris de la cellule vers elle : la
  // fermeture est différée, et entrer dans la bulle l'annule — on peut y
  // naviguer, la faire défiler, cliquer pour éditer.
  const scheduleTipClose = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    if (tipCloseTimer.current) clearTimeout(tipCloseTimer.current);
    tipCloseTimer.current = setTimeout(() => setTip(null), 160);
  };

  const keepTipOpen = () => {
    if (tipCloseTimer.current) clearTimeout(tipCloseTimer.current);
  };

  const showTip = () => {
    if (!value || editor) return;
    keepTipOpen();
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setTip(anchorBox(rect, 280, 260));
    }, 350);
  };

  /** `initial` : la frappe qui a ouvert la cellule. Sans elle, on repart du
      texte déjà là, comme au clic. */
  const openEditor = (initial?: string) => {
    if (readOnly) return;
    hideTip();
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraft(initial ?? value ?? "");
    setEditor(anchorBox(rect, 280, 280));
  };

  const save = () => {
    const next = draft.trim();
    if (next !== (value ?? "").trim()) onCommit(next || null);
    setEditor(null);
  };

  // Un défilement pendant l'édition laisserait le cadre flotter à côté de sa
  // cellule : on enregistre et on referme, comme un blur.
  useEffect(() => {
    if (!editor) return;
    const close = () => save();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
    // `save` change à chaque frappe ; réinscrire l'écouteur est sans coût.
  });

  const label = `${fieldName ?? "Wording"} de ${subjectName || "la publication"}`;

  return (
    <span className="group/wording relative block min-w-0 flex-1">
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        // Enveloppé : l'événement de clic passerait sinon pour la frappe
        // d'ouverture et se retrouverait dans le brouillon.
        onClick={() => openEditor()}
        onKeyDown={(event) => {
          // Le geste du tableur : on tape, la cellule s'ouvre sur ce
          // caractère. Sans lui, passer la Question d'un `<input>` à cette
          // cellule coûterait un clic de plus à chaque correction — Entrée et
          // Espace continuent d'ouvrir sur le texte existant, par le clic
          // natif du bouton.
          if (readOnly || editor) return;
          if (event.key.length !== 1 || event.key === " ") return;
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          openEditor(event.key);
        }}
        onMouseEnter={showTip}
        onMouseLeave={scheduleTipClose}
        onFocus={showTip}
        onBlur={scheduleTipClose}
        className={cn(
          "hover:bg-muted/60 focus-visible:ring-brand block w-full truncate rounded-sm px-1.5 py-1 text-sm outline-none focus-visible:ring-2",
          align === "left" ? "text-left" : "text-center",
        )}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {value ? value.replace(/\s+/g, " ") : "—"}
        </span>
      </button>

      {generateSubjectId ? (
        <span className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity duration-(--motion-duration) ease-standard group-hover/wording:opacity-100 has-focus-visible:opacity-100">
          <GenerateWordingButton
            subjectId={generateSubjectId}
            subjectName={subjectName}
          />
        </span>
      ) : null}

      {tip && !editor ? (
        // La bulle duplique la cellule pour l'œil : cachée aux lecteurs
        // d'écran, son clic n'est qu'un raccourci vers l'édition que la
        // cellule offre déjà.
        <span
          aria-hidden
          tabIndex={-1}
          style={tip}
          onMouseEnter={keepTipOpen}
          onMouseLeave={scheduleTipClose}
          onClick={() => openEditor()}
          className="border-border bg-surface text-foreground fixed z-50 block max-h-80 max-w-[75vw] cursor-text overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap shadow-lg"
        >
          {value}
        </span>
      ) : null}

      {editor ? (
        <span style={editor} className="fixed z-50 block max-w-[92vw]">
          <textarea
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => {
              const length = event.currentTarget.value.length;
              event.currentTarget.setSelectionRange(length, length);
            }}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setEditor(null);
              }
            }}
            aria-label={label}
            placeholder={
              placeholder ??
              "La caption publiable, ou l'intention en phase de planning."
            }
            className="border-ring bg-background field-sizing-content max-h-[60vh] min-h-36 w-full resize rounded-md border-2 px-3 pt-2 pb-7 text-sm shadow-xl outline-none"
          />
          <span
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute right-3 bottom-3 text-xs tabular-nums"
          >
            {draft.length} caractères
          </span>
        </span>
      ) : null}
    </span>
  );
}

// --- Visuels ------------------------------------------------------------------------

/**
 * La cellule Visuel : la première vignette et le compteur.
 *
 * Le clic ouvre le **panneau de la publication** — le plein écran s'atteint
 * depuis le panneau, en cliquant la créa. Un fichier se dépose directement
 * sur la cellule, sans passer par un sélecteur ; pendant l'envoi, la cellule
 * tourne — le seul retour utile pendant qu'une vidéo monte.
 */
export function VisualsCell({
  visuals,
  subjectName,
  uploading,
  onUpload,
  onRemove,
  onOpen,
  className,
}: {
  visuals: ResolvedVisual[];
  subjectName: string;
  uploading: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (path: string) => void;
  /** Ouvre le panneau de la publication. Absent : visionneuse (Mon travail). */
  onOpen?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const first = visuals[0];
  // La miniature d'abord — même pour une vidéo, dont le poster remplace le
  // trombone. Sans miniature, une image retombe sur l'original signé.
  const thumbUrl = first ? visualThumbUrl(first) : null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length > 0) onUpload(files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        aria-label={`Visuels de ${subjectName || "la publication"} (${visuals.length})`}
        onClick={() => {
          if (onOpen) onOpen();
          else if (visuals.length === 0) inputRef.current?.click();
          else setOpen(true);
        }}
        onDragOver={(event) => {
          if (![...event.dataTransfer.types].includes("Files")) return;
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(event) => {
          const files = [...event.dataTransfer.files];
          if (files.length === 0) return;
          event.preventDefault();
          setDropping(false);
          onUpload(files);
        }}
        className={cn(
          "hover:bg-muted/60 focus-visible:ring-brand flex w-full items-center justify-center gap-1 rounded-sm px-1 py-1 outline-none focus-visible:ring-2",
          dropping && "ring-brand bg-brand-mint/40 ring-2",
          className,
        )}
      >
        {uploading ? (
          <Loader2 className="text-accent-ink size-4 animate-spin" aria-label="Envoi en cours" />
        ) : first ? (
          <>
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée
              <img
                src={thumbUrl}
                alt=""
                className="size-6 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <Paperclip className="text-muted-foreground size-3.5" aria-hidden />
            )}
            {visuals.length > 1 ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                +{visuals.length - 1}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </button>

      {open ? (
        <VisualLightbox
          visuals={visuals}
          subjectName={subjectName}
          uploading={uploading}
          onClose={() => setOpen(false)}
          onUpload={onUpload}
          onRemove={onRemove}
        />
      ) : null}
    </>
  );
}

// --- Suppression de ligne -------------------------------------------------------

/**
 * La poubelle d'une ligne — et sa confirmation, portée ici plutôt qu'à chaque
 * appelant : une corbeille qui apparaît au survol est trop facile à toucher
 * par accident pour agir sans rien demander.
 */
export function DeleteRowButton({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Supprimer ${label}`}
        className="text-muted-foreground hover:text-danger-ink focus-visible:ring-ring rounded p-1 opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Supprimer ${label}`}
        description={`${label} part du tableau.`}
        confirmLabel="Supprimer"
        onConfirm={onDelete}
      />
    </>
  );
}
