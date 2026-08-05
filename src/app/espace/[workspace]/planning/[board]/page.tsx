import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FaqBoardView } from "@/components/planning/faq-board";
import { PlanningBoardView } from "@/components/planning/planning-board";
import { getWorkspace } from "@/lib/auth";
import { analyseCadence } from "@/lib/planning/cadence";
import {
  flattenSubjects,
  getBoard,
  getBoardContent,
  listFaqEntries,
} from "@/lib/planning/queries";
import { deduceStrategy } from "@/lib/planning/strategy";

type Params = Promise<{ workspace: string; board: string }>;

async function load(params: Params) {
  const { workspace: workspaceSlug, board: boardSlug } = await params;
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace) return null;

  const board = await getBoard(workspace.id, boardSlug);
  return board ? { workspace, board } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const loaded = await load(params);
  if (!loaded) return { title: "Introuvable" };
  return { title: `${loaded.board.name} · ${loaded.workspace.name}` };
}

function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function previousMonthKey(month: string): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const date = new Date(Date.UTC(year, index - 2, 1));
  return monthKeyOf(date);
}

export default async function PlanningBoardPage({ params }: { params: Params }) {
  const loaded = await load(params);
  if (!loaded) notFound();

  const { workspace, board } = loaded;
  const scope = { workspace: workspace.slug, board: board.slug };

  if (board.kind === "faq") {
    return (
      <FaqBoardView
        scope={scope}
        board={board}
        entries={await listFaqEntries(board.id)}
      />
    );
  }

  const { months, owners } = await getBoardContent(board);

  const now = new Date();
  const currentMonthKey = monthKeyOf(now);
  const all = flattenSubjects(months);

  // Le contrôle porte sur le mois en cours, celui qui est ouvert à l'arrivée.
  // Analyser les douze mois d'un coup produirait une liste que personne ne lit.
  const current = all.filter((subject) => subject.month_key === currentMonthKey);
  const issues =
    current.length === 0
      ? []
      : analyseCadence({
          month: currentMonthKey,
          subjects: current,
          previousSubjects: all.filter(
            (subject) => subject.month_key === previousMonthKey(currentMonthKey),
          ),
          strategy: deduceStrategy(all, { asOf: now }),
        });

  return (
    <PlanningBoardView
      scope={scope}
      board={board}
      months={months}
      owners={owners}
      issues={issues}
      currentMonthKey={currentMonthKey}
    />
  );
}
