"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import { toast } from "sonner";

import { setConversionRole, type ConversionRole } from "@/app/actions/social";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { safeAction } from "@/lib/context/safe-action";
import { formatValue } from "@/lib/format";
import {
  conversionRoleOf,
  type ConversionRoles,
  type CustomEventTotal,
} from "@/lib/reporting/real-data";
import { cn } from "@/lib/utils";

/**
 * Le réglage des conversions propres au client, **replié dans la barre de
 * page**, à côté de Synchroniser.
 *
 * Il occupait un panneau pleine largeur pour un seul événement chez le seul
 * client concerné : le poids visuel annonçait « voici le sujet de cet écran »
 * quand c'est un réglage qu'on touche deux fois par an. Un menu de 32 px de
 * haut, qui n'apparaît que s'il y a quelque chose à régler, dit la même chose
 * sans manger la page.
 *
 * Réservé au propriétaire : un client lit ses chiffres, il ne décide pas de
 * ce qui compte comme une vente. Pour lui le bouton n'existe pas — ni pour un
 * compte sans événement personnalisé, ce qui est le cas général.
 */

/**
 * Les types que Meta rend sans nom lisible. L'agrégat du pixel est le seul
 * connu à ce jour : l'API ne détaille pas les `trackCustom` par nom, elle en
 * rend la somme. Le nom brut reste la clé du réglage — seul l'affichage change.
 */
const EVENT_LABELS: Record<string, string> = {
  "offsite_conversion.fb_pixel_custom": "Conversions du pixel",
};

const ROLE_LABELS: Record<ConversionRole, string> = {
  achat: "Compte comme un achat",
  panier: "Compte comme une mise au panier",
  aucun: "Ne compte pas dans les conversions",
};

const ROLES: ConversionRole[] = ["achat", "panier", "aucun"];

function eventLabel(name: string): string {
  return EVENT_LABELS[name] ?? name;
}

export function ConversionsMenu({
  workspaceSlug,
  events,
  roles,
  isOwner,
}: {
  workspaceSlug: string;
  events: readonly CustomEventTotal[];
  roles: ConversionRoles;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  /* Optimiste, et porté par le menu plutôt que par ligne : le menu se referme
     au clic, et un état local par ligne disparaîtrait avec elle avant la
     réponse du serveur. */
  const [choisis, setChoisis] = useState<Record<string, ConversionRole>>({});

  if (!isOwner || events.length === 0) return null;

  const roleDe = (name: string): ConversionRole =>
    choisis[name] ?? conversionRoleOf(name, roles);

  const changer = (name: string, next: ConversionRole) => {
    if (next === roleDe(name)) return;
    const avant = roleDe(name);
    setChoisis((etat) => ({ ...etat, [name]: next }));
    start(async () => {
      const result = await safeAction(() =>
        setConversionRole(workspaceSlug, { name, role: next }),
      );
      if (!result.ok) {
        setChoisis((etat) => ({ ...etat, [name]: avant }));
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      {/* Déclencheur habillé par `buttonVariants`, jamais un `<Button>` passé
          en `render` : le primitif Base UI compose déjà son propre élément, et
          en imbriquer deux le fait échouer. Tous les menus du dépôt s'habillent
          ainsi. */}
      <DropdownMenuTrigger
        disabled={pending}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
      >
        <Tag className="size-4" strokeWidth={1.75} aria-hidden />
        Conversions
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 min-w-72">
        {/* Un `<div>` et non `DropdownMenuLabel` : celui-ci est un
            `Menu.GroupLabel`, que Base UI exige à l'intérieur d'un
            `Menu.Group`. Posé seul il jette l'erreur #31 et le menu s'ouvre
            vide — piège déjà payé sur le menu du compte et sur celui des
            colonnes du planning. */}
        <div className="px-2 py-1.5">
          <p className="type-label text-text-primary">Conversions du client</p>
          <p className="type-caption text-text-secondary mt-1">
            Ce que le pixel émet sous ses propres noms. Le rôle choisi les verse
            dans les achats ou les paniers — le chiffre d&apos;affaires ne suit
            que si l&apos;événement porte un montant.
          </p>
        </div>

        {events.map((event) => (
          <Fragment key={event.name}>
            <DropdownMenuSeparator />
            <div className="px-2 pt-1.5 pb-1">
              <p className="type-label text-text-primary truncate">
                {eventLabel(event.name)}
              </p>
              <p className="type-caption text-text-secondary mt-0.5">
                {formatValue(event.count, "integer")} sur la période
                {event.costPer !== null
                  ? ` · ${formatValue(event.costPer, "currency")} l'unité`
                  : ""}
                {event.value !== null
                  ? ` · ${formatValue(event.value, "currency")} de valeur`
                  : ""}
              </p>
            </div>
            <DropdownMenuRadioGroup
              value={roleDe(event.name)}
              onValueChange={(value) =>
                changer(event.name, value as ConversionRole)
              }
            >
              {ROLES.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {ROLE_LABELS[option]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
