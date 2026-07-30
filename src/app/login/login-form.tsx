"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError(null);

    const supabase = createClient();
    const callback = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_SITE_URL);
    if (next) callback.searchParams.set("suivant", next);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback.toString() },
    });

    if (signInError) {
      setError(signInError.message);
      setState("idle");
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="border-border bg-card space-y-2 rounded-lg border p-6 text-center">
        <CheckCircle2 className="text-primary mx-auto size-6" aria-hidden />
        <p className="font-medium">Lien envoyé</p>
        <p className="text-muted-foreground text-sm">
          Ouvrez l&apos;email reçu à <span className="font-medium">{email}</span>{" "}
          pour vous connecter. Le lien expire dans une heure.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="vous@exemple.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? "login-error" : undefined}
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error ? (
        <p id="login-error" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Envoi…
          </>
        ) : (
          "Recevoir le lien de connexion"
        )}
      </Button>
    </form>
  );
}
