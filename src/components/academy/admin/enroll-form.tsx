"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { enrollStudent } from "@/app/actions/academy";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Inscrire quelqu'un à une formation.
 *
 * Le courriel part tout seul quand `RESEND_API_KEY` est posée. Sinon —
 * et c'est le cas tant que le domaine d'envoi n'est pas vérifié —
 * l'inscription est **quand même écrite** et le lien s'affiche ici, à copier
 * et envoyer à la main. Une dégradation qui laisse le module utilisable vaut
 * mieux qu'un bouton qui refuse de travailler.
 */
export function EnrollForm({
  courses,
  defaultCourseId,
}: {
  courses: { id: string; title: string }[];
  defaultCourseId: string;
}) {
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = await enrollStudent({
              courseId,
              email,
              firstName,
              lastName,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(result.message);
            // Le lien n'est montré que s'il n'est pas parti tout seul : le
            // laisser à l'écran après un envoi réussi inviterait à le renvoyer
            // une seconde fois, et il n'est valable qu'une.
            setLink(result.sent ? null : result.link);
            setEmail("");
            setFirstName("");
            setLastName("");
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="inscrire-prenom">Prénom</Label>
            <Input
              id="inscrire-prenom"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Camille"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inscrire-nom">Nom</Label>
            <Input
              id="inscrire-nom"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Roux"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inscrire-email">Adresse email</Label>
            <Input
              id="inscrire-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="camille@exemple.fr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inscrire-formation">Formation</Label>
            <select
              id="inscrire-formation"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button type="submit" variant="accent" disabled={pending || !email.trim()}>
          <PendingLabel pending={pending} busy="Inscription…">
            Inscrire et envoyer l&apos;accès
          </PendingLabel>
        </Button>
      </form>

      {link ? (
        <div className="rounded-md border border-border bg-warning-subtle p-4">
          <p className="type-caption text-text-primary">
            Le courriel n&apos;est pas parti — envoie ce lien à la main. Il est
            valable 24 heures.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="type-caption min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 text-text-primary">
              {link}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                toast.success("Lien copié.");
              }}
            >
              <Copy data-icon="inline-start" aria-hidden strokeWidth={1.75} />
              Copier
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
