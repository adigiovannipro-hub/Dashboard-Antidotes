"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Les trois volets d'une leçon : le script, les ressources, mes notes.
 *
 * Le contenu des volets arrive **rendu du serveur** — le script est parsé et
 * mis en page là-bas, seul l'état « quel onglet est ouvert » vit ici. Le
 * volet des notes est le seul interactif, et il gère sa sauvegarde lui-même.
 */
/** L'encre d'un onglet au repos — l'actif garde celle du composant. */
const INACTIVE_INK = "text-text-secondary";

export function LessonTabs({
  script,
  resources,
  notes,
  resourceCount,
}: {
  script: React.ReactNode;
  resources: React.ReactNode;
  notes: React.ReactNode;
  resourceCount: number;
}) {
  return (
    <Tabs defaultValue="script">
      <TabsList>
        {/* L'onglet inactif de shadcn est à `text-foreground/60`, mesuré à
            4,46:1 sur la gouttière — juste sous le seuil. L'encre secondaire
            le remonte sans toucher au composant partagé ; tailwind-merge
            garde la dernière couleur de la même famille. */}
        <TabsTrigger value="script" className={INACTIVE_INK}>
          Script
        </TabsTrigger>
        <TabsTrigger value="ressources" className={INACTIVE_INK}>
          Ressources{resourceCount > 0 ? ` (${resourceCount})` : ""}
        </TabsTrigger>
        <TabsTrigger value="notes" className={INACTIVE_INK}>
          Mes notes
        </TabsTrigger>
      </TabsList>
      <TabsContent value="script" className="pt-4">
        {script}
      </TabsContent>
      <TabsContent value="ressources" className="pt-4">
        {resources}
      </TabsContent>
      <TabsContent value="notes" className="pt-4">
        {notes}
      </TabsContent>
    </Tabs>
  );
}
