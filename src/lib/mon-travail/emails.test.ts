import { describe, expect, it } from "vitest";

import {
  gmailThreadUrl,
  isAutomatedSender,
  planEmailTasks,
  type EmailContext,
  type EmailMessage,
} from "./emails";

const message = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  id: "msg-1",
  threadId: "thread-1",
  subject: "Re: Shooting septembre",
  fromEmail: "claire@bondet.fr",
  fromName: "Claire Bondet",
  ...overrides,
});

const context = (overrides: Partial<EmailContext> = {}): EmailContext => ({
  orgId: "org-1",
  today: "2026-08-30",
  messages: [message()],
  workspaces: [
    { id: "ws-bondet", slug: "bondet", name: "Bondet" },
    { id: "ws-iway", slug: "i-way", name: "I-WAY" },
  ],
  ...overrides,
});

describe("planEmailTasks", () => {
  it("transforme un mail non lu en tâche du jour, rattachée au client", () => {
    const plan = planEmailTasks(context());

    expect(plan.tasks).toHaveLength(1);
    const task = plan.tasks[0]!;
    expect(task.title).toBe("Répondre à Claire Bondet — Re: Shooting septembre");
    expect(task.workspace_id).toBe("ws-bondet");
    expect(task.due_date).toBe("2026-08-30");
    expect(task.dedupe_key).toBe("email:msg-1");
    expect(task.source_url).toBe(gmailThreadUrl("thread-1"));
  });

  it("écarte les expéditeurs automatiques et les compte", () => {
    const plan = planEmailTasks(
      context({
        messages: [
          message({ fromEmail: "no-reply@vercel.com", fromName: null }),
          message({ id: "msg-2", fromEmail: "notification@github.com" }),
        ],
      }),
    );

    expect(plan.tasks).toHaveLength(0);
    expect(plan.skipped.automatique).toBe(2);
  });

  it("écarte un message sans objet plutôt que d'inventer un titre", () => {
    const plan = planEmailTasks(
      context({ messages: [message({ subject: "  " })] }),
    );

    expect(plan.tasks).toHaveLength(0);
    expect(plan.skipped["sans-objet"]).toBe(1);
  });

  it("laisse la tâche sans client au moindre doute et le signale", () => {
    const plan = planEmailTasks(
      context({
        messages: [
          message({
            subject: "Interview fondateur",
            fromEmail: "agence@presse.fr",
            fromName: "Agence RP",
          }),
        ],
      }),
    );

    expect(plan.tasks[0]!.workspace_id).toBeNull();
    expect(plan.withoutClient).toEqual(["Interview fondateur"]);
  });

  it("prend l'adresse comme nom quand l'expéditeur n'en a pas", () => {
    const plan = planEmailTasks(
      context({ messages: [message({ fromName: null })] }),
    );

    expect(plan.tasks[0]!.title).toBe(
      "Répondre à claire@bondet.fr — Re: Shooting septembre",
    );
  });
});

describe("isAutomatedSender", () => {
  it("reconnaît les variantes de no-reply", () => {
    expect(isAutomatedSender("noreply@stripe.com")).toBe(true);
    expect(isAutomatedSender("do-not-reply@meta.com")).toBe(true);
    expect(isAutomatedSender("claire@bondet.fr")).toBe(false);
  });
});
