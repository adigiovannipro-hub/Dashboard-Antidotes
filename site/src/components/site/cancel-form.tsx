"use client";

import { useActionState } from "react";

import type { CancelResult } from "@/app/actions/cancel";

export function CancelForm({
  token,
  labels,
  action,
}: {
  token: string;
  labels: { confirm: string; done: string; doneText: string; generic: string };
  action: (token: string) => Promise<CancelResult>;
}) {
  const [state, submit, pending] = useActionState<CancelResult | null>(async () => action(token), null);
  if (state?.ok) {
    return (
      <div className="mt-6" aria-live="polite">
        <p className="type-h3 text-text">{labels.done}</p>
        <p className="type-body mt-2 text-text-2">{labels.doneText}</p>
      </div>
    );
  }
  return (
    <form action={submit} className="mt-6">
      <button
        type="submit"
        disabled={pending}
        className="type-body inline-flex rounded-pill border border-line-strong px-6 py-3 text-text transition-colors duration-(--motion) hover:bg-field disabled:opacity-60"
      >
        {labels.confirm}
      </button>
      {state && !state.ok ? (
        <p className="type-small mt-3 text-danger-ink" role="alert">
          {labels.generic}
        </p>
      ) : null}
    </form>
  );
}
