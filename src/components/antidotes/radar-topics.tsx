"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, X } from "lucide-react";
import { toast } from "sonner";

import { setTopicStatus } from "@/app/actions/antidotes-inbound";
import { StatusPill } from "@/components/ds/status-pill";
import { PanelRows } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { TOPIC_STATUS_LABELS, type RadarTopic } from "@/lib/antidotes/types";

/** Les sujets proposés : un titre, un angle, les posts qui l'appuient, écrire ou écarter. */
export function RadarTopics({ topics }: { topics: RadarTopic[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function dismiss(topicId: string) {
    startTransition(async () => {
      const result = await setTopicStatus({ topicId, status: "dismissed" });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <PanelRows>
      {topics.map((topic) => (
        <div key={topic.id} className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-label text-text-primary">{topic.title}</span>
              {topic.status !== "new" ? <StatusPill tone="neutral" dot={false}>{TOPIC_STATUS_LABELS[topic.status]}</StatusPill> : null}
              <span className="type-caption text-text-secondary">
                {topic.evidence.length} post{topic.evidence.length > 1 ? "s" : ""} à l&apos;appui
              </span>
            </div>
            {topic.angle ? <p className="type-body mt-1 text-text-secondary">{topic.angle}</p> : null}
            {topic.evidence[0]?.why ? <p className="type-caption mt-1 text-text-secondary">{topic.evidence[0].why}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button render={<Link href={`/antidotes/inbound/studio?sujet=${topic.id}`} />} size="sm" variant="outline">
              <PenLine aria-hidden />
              Écrire
            </Button>
            {topic.status === "new" ? (
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => dismiss(topic.id)}>
                <X aria-hidden />
                Écarter
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </PanelRows>
  );
}
