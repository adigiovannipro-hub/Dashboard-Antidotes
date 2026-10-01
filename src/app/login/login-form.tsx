"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestLoginLink } from "@/app/actions/login";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError(null);

    // Le lien part par la boîte de l'agence : celle de Supabase ne délivre
    // qu'à l'équipe du projet, et un client ne recevait jamais rien.
    let result: Awaited<ReturnType<typeof requestLoginLink>>;
    try {
      result = await requestLoginLink({ email: email.trim(), next });
    } catch {
      result = { ok: true, fallback: true };
    }

    if (!result.ok) {
      setError(result.error);
      setState("idle");
      return;
    }

    if (result.fallback) {
      // Boîte d'envoi indisponible : on repasse par Supabase, qui délivre au
      // moins à l'agence — sans ce repli, une boîte Gmail déconnectée
      // fermerait l'application à son propriétaire. `shouldCreateUser: false` :
      // une adresse inconnue ne se crée pas de compte par ce chemin.
      /* L'origine réelle du navigateur, et non `NEXT_PUBLIC_SITE_URL`, qui
         vaut `http://localhost:3000` par défaut. */
      const callback = new URL("/auth/callback", window.location.origin);
      if (next) callback.searchParams.set("suivant", next);
      const { error: signInError } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.toString(), shouldCreateUser: false },
      });
      if (signInError && !/signups? not allowed|user not found/i.test(signInError.message)) {
        setError(signInError.message);
        setState("idle");
        return;
      }
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="border-border bg-card space-y-2 rounded-lg border p-6 text-center">
        <CheckCircle2 className="text-primary mx-auto size-6" aria-hidden />
        <p className="font-medium">Vérifiez votre boîte</p>
        <p className="text-muted-foreground text-sm">
          Si <span className="font-medium">{email}</span> a un accès, un lien de
          connexion vient d&apos;y partir. Il expire dans une heure.
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
