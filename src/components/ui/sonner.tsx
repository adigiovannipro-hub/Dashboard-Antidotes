"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/*
 * Les toasts de Monday : un bandeau plein en haut de l'écran, vert pour ce
 * qui a réussi, rouge pour ce qui a échoué, texte blanc et croix à droite.
 * En bas à droite, ils passaient par-dessus la barre d'actions groupées —
 * précisément là où l'on agit quand ils apparaissent.
 *
 * Les aplats sont des jetons fixes (`--toast-*`) : une couleur qui s'inverse
 * en sombre ferait tomber le blanc posé dessus sous le seuil.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      offset={12}
      icons={{
        success: (
          <CircleCheckIcon className="size-4.5" />
        ),
        info: (
          <InfoIcon className="size-4.5" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4.5" />
        ),
        error: (
          <OctagonXIcon className="size-4.5" />
        ),
        loading: (
          <Loader2Icon className="size-4.5 animate-spin" />
        ),
      }}
      style={
        {
          "--width": "420px",
          "--normal-bg": "var(--toast-neutral)",
          "--normal-text": "var(--toast-text)",
          "--normal-border": "transparent",
          "--success-bg": "var(--toast-success)",
          "--success-text": "var(--toast-text)",
          "--success-border": "transparent",
          "--error-bg": "var(--toast-danger)",
          "--error-text": "var(--toast-text)",
          "--error-border": "transparent",
          "--warning-bg": "var(--toast-warning)",
          "--warning-text": "var(--toast-text)",
          "--warning-border": "transparent",
          "--info-bg": "var(--toast-info)",
          "--info-text": "var(--toast-text)",
          "--info-border": "transparent",
          "--border-radius": "var(--r-sm)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
