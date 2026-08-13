"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ImageUp, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import {
  attachLogo,
  deleteWorkspace,
  duplicateWorkspace,
  loadWorkspaceAdmin,
  prepareLogoUpload,
  removeLogo,
  renameWorkspace,
  type WorkspaceResult,
} from "@/app/actions/workspaces";
import { PendingLabel } from "@/components/ds/pending-label";
import { safeAction } from "@/lib/context/safe-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { PartnersDialog, type WorkspaceAdminData } from "./partners-dialog";

/**
 * Les trois points d'un espace, dans le rail.
 *
 * Renommer, dupliquer, régler les droits d'un partenaire, supprimer. Rien
 * de tout ça n'était accessible sans passer par la base ; l'administration
 * d'un espace se fait maintenant depuis l'endroit où on le voit.
 *
 * Le bouton se montre au survol sur grand écran et reste visible au doigt :
 * une commande qui n'apparaît qu'au survol n'existe pas sur un téléphone.
 */

type Dialogue = "rename" | "duplicate" | "delete" | "partners" | "logo";

export function WorkspaceMenu({
  slug,
  name,
  collapsed,
}: {
  slug: string;
  name: string;
  /** Rail replié : il n'y a plus la place, et le libellé non plus n'y est pas. */
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [admin, setAdmin] = useState<WorkspaceAdminData | null>(null);
  const [, startLoad] = useTransition();

  /**
   * La lecture part du clic, pas d'un effet : c'est une réponse à une
   * interaction, et React demande justement de ne pas déporter ça dans un
   * `useEffect`. Le rail, lui, ne charge rien tant qu'on ne lui demande rien.
   */
  const loadAdmin = useCallback(() => {
    startLoad(async () => {
      const result = await safeAction(() => loadWorkspaceAdmin({ workspace: slug }));
      if (!result.ok) {
        toast.error(result.error);
        setAdmin({ pages: [], partners: [] });
        return;
      }
      setAdmin({ pages: result.pages, partners: result.partners });
    });
  }, [slug]);

  if (collapsed) return null;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label={`Options de ${name}`}
          className={cn(
            "hover:bg-muted focus-visible:ring-ring flex size-7 shrink-0 items-center justify-center rounded-sm text-text-secondary transition-opacity duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
            "md:opacity-0 md:group-hover/espace:opacity-100 md:focus-visible:opacity-100",
            open && "md:opacity-100",
          )}
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 min-w-56">
          <DropdownMenuItem onClick={() => setDialogue("rename")}>
            <Pencil className="size-3.5" aria-hidden />
            Renommer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialogue("logo")}>
            <ImageUp className="size-3.5" aria-hidden />
            Logo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialogue("duplicate")}>
            <Copy className="size-3.5" aria-hidden />
            Dupliquer
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setAdmin(null);
              setDialogue("partners");
              loadAdmin();
            }}
          >
            <Users className="size-3.5" aria-hidden />
            Partenaires et droits
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setDialogue("delete")}>
            <Trash2 className="size-3.5" aria-hidden />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Monté seulement quand il s'ouvre : chaque dialogue repart ainsi de
          l'état courant. Un dialogue gardé en vie afficherait encore l'ancien
          nom au second passage. */}
      {dialogue === "rename" ? (
        <RenameDialog slug={slug} name={name} onClose={() => setDialogue(null)} />
      ) : null}
      {dialogue === "logo" ? (
        <LogoDialog slug={slug} name={name} onClose={() => setDialogue(null)} />
      ) : null}
      {dialogue === "duplicate" ? (
        <DuplicateDialog slug={slug} name={name} onClose={() => setDialogue(null)} />
      ) : null}
      {dialogue === "delete" ? (
        <DeleteDialog slug={slug} name={name} onClose={() => setDialogue(null)} />
      ) : null}
      {dialogue === "partners" ? (
        <PartnersDialog
          slug={slug}
          name={name}
          data={admin}
          onReload={loadAdmin}
          onClose={() => setDialogue(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Le logo d'un espace.
 *
 * Le fichier part **du navigateur directement dans le bucket** : une action
 * serveur se ferait tronquer par le proxy, et ferait transiter l'image par la
 * fonction pour rien. L'action ne fait que signer l'URL d'envoi, puis
 * accrocher le chemin.
 */
function LogoDialog({
  slug,
  name,
  onClose,
}: {
  slug: string;
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const envoyer = (file: File) => {
    start(async () => {
      const prepared = await safeAction(() =>
        prepareLogoUpload({ workspace: slug }, {
          name: file.name,
          type: file.type,
          size: file.size,
        }),
      );
      if (!prepared.ok) {
        toast.error(prepared.error);
        return;
      }

      const upload = await fetch(prepared.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      }).catch(() => null);
      if (!upload?.ok) {
        toast.error("Envoi interrompu. Réessayer.");
        return;
      }

      const attached = await safeAction(() =>
        attachLogo({ workspace: slug }, { path: prepared.path }),
      );
      if (!attached.ok) {
        toast.error(attached.error);
        return;
      }
      toast.success(attached.message);
      onClose();
      router.refresh();
    });
  };

  const retirer = () => {
    start(async () => {
      const result = await safeAction(() => removeLogo({ workspace: slug }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Logo de {name}</DialogTitle>
          <DialogDescription>
            Il remplace la pastille de couleur dans le rail et sur la carte
            d&apos;accueil. PNG, JPG, WebP ou SVG, 2 Mo maximum. Un carré rend
            mieux qu&apos;un rectangle très allongé.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) envoyer(file);
          }}
        />

        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={retirer}>
            Retirer
          </Button>
          <Button disabled={pending} onClick={() => input.current?.click()}>
            {pending ? "En cours…" : "Choisir un fichier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  slug,
  name,
  onClose,
}: {
  slug: string;
  name: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(name);

  return (
    <ActionDialog
      onClose={onClose}
      title="Renommer l'espace"
      description="Le nom affiché change partout. L'adresse de l'espace ne bouge pas : les liens déjà partagés continuent de fonctionner."
      submitLabel="Renommer"
      disabled={draft.trim().length < 2 || draft.trim() === name}
      run={() => renameWorkspace({ workspace: slug }, { name: draft })}
    >
      <label className="flex flex-col gap-1.5">
        <span className="type-overline text-text-secondary">Nom de l&apos;espace</span>
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Nom de l'espace"
        />
      </label>
    </ActionDialog>
  );
}

function DuplicateDialog({
  slug,
  name,
  onClose,
}: {
  slug: string;
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(`${name} (copie)`);

  return (
    <ActionDialog
      onClose={onClose}
      title="Dupliquer l'espace"
      description="Copie la configuration : les tableaux avec leurs colonnes et leur vocabulaire, les tableaux de bord. Aucune publication, aucun document, aucun brief ne suit."
      submitLabel="Dupliquer"
      disabled={draft.trim().length < 2}
      run={() => duplicateWorkspace({ workspace: slug }, { name: draft })}
      onDone={(result) => {
        if (result.ok && result.slug) router.push(`/espace/${result.slug}`);
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="type-overline text-text-secondary">Nom du nouvel espace</span>
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Nom du nouvel espace"
        />
      </label>
    </ActionDialog>
  );
}

function DeleteDialog({
  slug,
  name,
  onClose,
}: {
  slug: string;
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");

  return (
    <ActionDialog
      onClose={onClose}
      title={`Supprimer ${name}`}
      description="Définitif, et sans reprise possible : planning, publications, visuels, documents, brief, tableaux de bord et accès partent avec l'espace."
      submitLabel="Supprimer définitivement"
      destructive
      disabled={confirmation.trim() !== name}
      run={() => deleteWorkspace({ workspace: slug }, { confirmation })}
      onDone={(result) => {
        if (result.ok) router.push("/");
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="type-overline text-text-secondary">
          Saisir « {name} » pour confirmer
        </span>
        <Input
          autoFocus
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          aria-label={`Saisir ${name} pour confirmer la suppression`}
        />
      </label>
    </ActionDialog>
  );
}

/** Le cadre commun aux trois : un champ, une phrase, un bouton qui agit. */
function ActionDialog({
  onClose,
  title,
  description,
  submitLabel,
  destructive,
  disabled,
  run,
  onDone,
  children,
}: {
  onClose: () => void;
  title: string;
  description: string;
  submitLabel: string;
  destructive?: boolean;
  disabled: boolean;
  run: () => Promise<WorkspaceResult>;
  onDone?: (result: WorkspaceResult) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const result = await safeAction(run);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onClose();
      onDone?.(result);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-1">{children}</div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={disabled || pending}
            onClick={submit}
          >
            <PendingLabel pending={pending} busy="En cours…">
              {submitLabel}
            </PendingLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
