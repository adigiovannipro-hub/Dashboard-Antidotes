import Link from "next/link";

import { Logo } from "@/components/ds/logo";
import { cancelBookingAction } from "@/app/actions/cancel";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { getBooking } from "@/lib/db";
import { whenWithZone } from "@/lib/mail/format";
import { CancelForm } from "./cancel-form";

/** La page d'annulation : un seul bouton, et c'est le POST qui annule. */
export async function CancelBookingPage({ token, dict, locale }: { token: string; dict: Dictionary; locale: Locale }) {
  const valid = /^[0-9a-f]{32}$/.test(token);
  const booking = valid ? await getBooking(token) : null;
  const t = dict.cancelPage;
  return (
    <main className="bg-aura relative isolate flex min-h-svh w-full flex-col justify-center overflow-hidden px-5 py-16">
      <span aria-hidden className="ring-light -right-[30vw] -top-[20vw] -z-10 w-[80vw] min-w-[520px]" />
      <div className="mx-auto w-full max-w-xl">
        <Link href={localePath(locale)} aria-label="antidotes" className="inline-block text-text">
          <Logo height={22} />
        </Link>
        <div className="glass mt-10 rounded-xl p-8">
          <h1 className="type-h2 text-text">{t.title}</h1>
          {!booking ? (
            <p className="type-body mt-4 text-text-2">{t.missing}</p>
          ) : booking.status === "cancelled" ? (
            <p className="type-body mt-4 text-text-2">{t.already}</p>
          ) : (
            <>
              <p className="type-lead mt-4 text-text">{whenWithZone(new Date(booking.starts_at), booking.prospect_timezone, locale)}</p>
              <p className="type-body mt-4 text-text-2">{t.text}</p>
              <CancelForm token={token} labels={{ confirm: t.confirm, done: t.done, doneText: t.doneText, generic: t.missing }} action={cancelBookingAction} />
            </>
          )}
          <Link href={localePath(locale)} className="type-small mt-8 inline-block text-text-2 underline underline-offset-4 hover:text-text">
            {t.back}
          </Link>
        </div>
      </div>
    </main>
  );
}
