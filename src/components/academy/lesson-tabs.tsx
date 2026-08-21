"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Les trois volets d'une leçon : le script, les ressources, mes notes.
 *
 * Le contenu des volets arrive **rendu du serveur** — le script est parsé et
 * mis en page là-bas, seul l'état « quel onglet est ouvert » vit ici. Le
 * volet des notes est le seul interactif, et il gère sa sauvegarde lui-même.
 */
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
        <TabsTrigger value="script">Script</TabsTrigger>
        <TabsTrigger value="ressources">
          Ressources{resourceCount > 0 ? ` (${resourceCount})` : ""}
        </TabsTrigger>
        <TabsTrigger value="notes">Mes notes</TabsTrigger>
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
