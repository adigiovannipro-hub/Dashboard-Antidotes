"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";

import { saveCampaign, type SourcingResult } from "@/app/actions/antidotes-sourcing";
import { NativeSelect, TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill } from "@/components/ds/status-pill";
import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeAdLibraryUrl, parseAdLibraryUrl } from "@/lib/antidotes/sourcing/ad-library-url";
import type { ProviderAvailability } from "@/lib/antidotes/sourcing/assemble";
import type { ResolvedCampaignConfig } from "@/lib/antidotes/sourcing/config";
import { COUNTRIES, countryName, isKnownCountry } from "@/lib/antidotes/sourcing/countries";
import {
  DISCOVERY_SOURCE_KEY_LABELS,
  EMAIL_PROVIDER_LABELS,
  type Campaign,
  type DiscoverySourceKey,
  type EmailProviderKey,
} from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Les réglages d'une campagne — tout ce que le cahier des charges décrit, et
 * rien en dur. Un panneau par étape de la chaîne : la cible, les filtres, le
 * décisionnaire, les adresses, le score. Le formulaire envoie tout d'un bloc,
 * l'action reconstruit les trois jsonb.
 *
 * Les listes se saisissent une entrée par ligne : des chips à la souris
 * seraient plus jolis et deux fois plus longs à taper pour vingt villes.
 * Les pays, eux, se choisissent dans une liste fermée : « FR, BE » se tapait
 * sans repère et se relisait mal.
 */

/** Les repères de trafic — demandés explicitement, l'exception à la sobriété des écrans. */
const TRAFFIC_HINT =
  "Boutique de niche : 2 000 à 10 000 visites par mois · marque installée : 50 000 et plus. Vide : pas de filtre.";
const REFERENCE_TRAFFIC_HINT =
  "Le trafic estimé du site du client, que l'on retrouve dans SimilarWeb ou le rapport Site web du Reporting.";
const AD_LIBRARY_HINT =
  "Collez l'URL d'une recherche ou d'une page annonceur : le pays et la requête servent à vérifier les publicités actives.";

export function CampaignForm({
  campaign,
  config,
  availability,
}: {
  campaign: Campaign;
  config: ResolvedCampaignConfig;
  availability: ProviderAvailability;
}) {
  const [state, formAction, pending] = useActionState<SourcingResult | null, FormData>(
    saveCampaign,
    null,
  );
  const lastState = useRef<SourcingResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) toast.success(state.message ?? "Enregistré.");
    else toast.error(state.error);
  }, [state]);

  const maps = campaign.engine === "maps";
  const referenceSize = maps
    ? (config.filters.reference_size?.reviews_count ?? null)
    : (config.filters.reference_size?.traffic ?? null);

  // La pastille dit ce que la Bibliothèque collée donne à lire, à la frappe :
  // un silence se lirait comme « rien n'a été compris » sans le dire.
  const [adLibraryUrl, setAdLibraryUrl] = useState(config.source.ad_library_url ?? "");
  const adLibrary = adLibraryUrl.trim().length > 0 ? parseAdLibraryUrl(adLibraryUrl) : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="campaignId" value={campaign.id} />
      <input type="hidden" name="engine" value={campaign.engine} />

      <Panel>
        <PanelHeader title="Campagne" />
        <PanelBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" htmlFor="c-name">
            <Input id="c-name" name="name" required maxLength={120} defaultValue={campaign.name} />
          </Field>
          <Field label="Client de référence" htmlFor="c-reference">
            <Input
              id="c-reference"
              name="referenceClient"
              maxLength={120}
              defaultValue={campaign.reference_client ?? ""}
              placeholder="Bondet"
            />
          </Field>
          <label className="type-caption flex items-center gap-2 text-text-primary sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={campaign.is_active}
              className="size-4 accent-[var(--accent-ink)]"
            />
            Campagne active
          </label>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Cible"
          description={maps ? "Google Maps, par Apify." : "Boutiques en ligne."}
          action={
            !(maps ? availability.maps : availability.ecommerce) ? (
              <span className="type-caption text-warning-ink">
                {maps ? "APIFY_TOKEN absent" : "Aucune source branchée"}
              </span>
            ) : null
          }
        />
        <PanelBody className="grid gap-3 sm:grid-cols-2">
          {maps ? (
            <>
              <Field label="Mots-clés métier" htmlFor="c-keywords" hint="un par ligne">
                <TextArea
                  id="c-keywords"
                  name="keywords"
                  required
                  defaultValue={config.source.keywords.join("\n")}
                  placeholder={"opticien\nlunetier"}
                />
              </Field>
              <Field label="Villes" htmlFor="c-cities" hint="une par ligne">
                <TextArea
                  id="c-cities"
                  name="cities"
                  required
                  defaultValue={config.source.cities.join("\n")}
                  placeholder={"Lyon\nVilleurbanne"}
                />
              </Field>
              <Field label="Rayon (km)" htmlFor="c-radius">
                <Input id="c-radius" name="radiusKm" type="number" min={1} max={200} defaultValue={config.source.radius_km} />
              </Field>
              <Field label="Lieux par recherche" htmlFor="c-max">
                <Input id="c-max" name="maxPlaces" type="number" min={1} max={1000} defaultValue={config.source.max_places} />
              </Field>
              <Field label="Pays" htmlFor="c-country">
                <CountrySelect id="c-country" name="country" defaultValue={config.source.country} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Catégorie" htmlFor="c-category">
                <Input id="c-category" name="category" required maxLength={120} defaultValue={config.source.category} placeholder="Accessoires de mode" />
              </Field>
              <Field label="Pays" htmlFor="c-country">
                <CountrySelect id="c-country" name="country" defaultValue={config.source.country} />
              </Field>
              <Field label="Trafic mensuel minimum" htmlFor="c-tmin" note={TRAFFIC_HINT}>
                <Input id="c-tmin" name="trafficMin" type="number" min={0} defaultValue={config.source.traffic_min ?? ""} />
              </Field>
              <Field label="Trafic mensuel maximum" htmlFor="c-tmax" note={TRAFFIC_HINT}>
                <Input id="c-tmax" name="trafficMax" type="number" min={0} defaultValue={config.source.traffic_max ?? ""} />
              </Field>
            </>
          )}
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="c-adlibrary">Bibliothèque publicitaire Meta</Label>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="c-adlibrary"
                name="adLibraryUrl"
                type="text"
                inputMode="url"
                maxLength={2000}
                className="min-w-0 flex-1"
                value={adLibraryUrl}
                onChange={(event) => setAdLibraryUrl(event.target.value)}
                placeholder="https://www.facebook.com/ads/library/?country=FR&q=lunettes"
              />
              {adLibrary === undefined ? null : adLibrary === null ? (
                <StatusPill tone="warning" className="shrink-0 self-start sm:self-auto">
                  URL non reconnue
                </StatusPill>
              ) : (
                <StatusPill tone="positive" className="shrink-0 self-start sm:self-auto">
                  {describeAdLibraryUrl(adLibrary)}
                </StatusPill>
              )}
            </div>
            <p className="type-caption text-text-secondary">{AD_LIBRARY_HINT}</p>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Filtres"
          description="Ce qu'une société doit passer avant d'être enrichie."
          action={
            !availability.ads ? (
              <span className="type-caption text-warning-ink">META_AD_LIBRARY_TOKEN absent</span>
            ) : null
          }
        />
        <PanelBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Tolérance de taille (%)" htmlFor="c-tolerance" hint="autour du client de référence">
            <Input
              id="c-tolerance"
              name="sizeTolerance"
              type="number"
              min={10}
              max={100}
              defaultValue={Math.round(config.filters.size_tolerance * 100)}
            />
          </Field>
          <Field
            label={maps ? "Avis Google du client de référence" : "Trafic mensuel du client de référence"}
            htmlFor="c-refsize"
            note={maps ? undefined : REFERENCE_TRAFFIC_HINT}
          >
            <Input id="c-refsize" name="referenceSize" type="number" min={0} defaultValue={referenceSize ?? ""} />
          </Field>
          <Field label="Publicités actives" htmlFor="c-ads">
            <NativeSelect
              id="c-ads"
              name="requireAds"
              defaultValue={
                config.filters.require_ads === true ? "oui" : config.filters.require_ads === false ? "non" : "bonus"
              }
            >
              <option value="oui">Requises</option>
              <option value="non">Ignorées</option>
              <option value="bonus">En bonus au score</option>
            </NativeSelect>
          </Field>
          <Field label="Note Google minimale" htmlFor="c-rating">
            <Input id="c-rating" name="minRating" type="number" min={0} max={5} step={0.1} defaultValue={config.filters.min_rating} />
          </Field>
          <Field label="Secteur du client de référence" htmlFor="c-sector" hint="pour le bonus de secteur">
            <Input id="c-sector" name="referenceSector" maxLength={120} defaultValue={config.filters.reference_sector ?? ""} placeholder="Opticien" />
          </Field>
          <CountryChecklist name="countries" checked={config.filters.countries} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Décisionnaire" description="Les postes visés, et où les chercher." />
        <PanelBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Postes ciblés" htmlFor="c-jobs" hint="un par ligne">
            <TextArea id="c-jobs" name="jobKeywords" className="min-h-32" defaultValue={config.targeting.job_keywords.join("\n")} />
          </Field>
          <div className="grid gap-3">
            <Field label="Viser le marketing à partir de (salariés)" htmlFor="c-threshold">
              <Input id="c-threshold" name="marketingThreshold" type="number" min={0} defaultValue={config.targeting.marketing_threshold} />
            </Field>
            <OrderedToggles
              legend="Sources, dans l'ordre"
              orderName="discoveryOrder"
              prefix="discovery"
              entries={config.targeting.discovery_sources.map((entry) => ({
                key: entry.source,
                enabled: entry.enabled,
                label: DISCOVERY_SOURCE_KEY_LABELS[entry.source],
                available: availability[entry.source],
              }))}
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Adresses" description="La cascade de fournisseurs, jusqu'à une adresse valide." />
        <PanelBody className="grid gap-3 sm:grid-cols-2">
          <OrderedToggles
            legend="Fournisseurs, dans l'ordre"
            orderName="enrichmentOrder"
            prefix="email"
            entries={config.targeting.enrichment_waterfall.map((entry) => ({
              key: entry.provider,
              enabled: entry.enabled,
              label: EMAIL_PROVIDER_LABELS[entry.provider],
              available: availability[entry.provider],
            }))}
          />
          <Field label="Revérifier après (jours)" htmlFor="c-ttl">
            <Input id="c-ttl" name="verificationTtlDays" type="number" min={1} max={3650} defaultValue={config.targeting.verification_ttl_days} />
          </Field>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Score" description="Les quatre poids, sur 100." />
        <PanelBody className="grid gap-3 sm:grid-cols-4">
          <Field label="Publicités actives" htmlFor="c-w1">
            <Input id="c-w1" name="weightAds" type="number" min={0} max={100} defaultValue={config.filters.scoring.ads_active} />
          </Field>
          <Field label="Taille dans la tolérance" htmlFor="c-w2">
            <Input id="c-w2" name="weightSize" type="number" min={0} max={100} defaultValue={config.filters.scoring.size_in_range} />
          </Field>
          <Field label="Contact joignable" htmlFor="c-w3">
            <Input id="c-w3" name="weightContact" type="number" min={0} max={100} defaultValue={config.filters.scoring.reachable_contact} />
          </Field>
          <Field label="Même secteur" htmlFor="c-w4">
            <Input id="c-w4" name="weightSector" type="number" min={0} max={100} defaultValue={config.filters.scoring.same_sector} />
          </Field>
        </PanelBody>
      </Panel>

      <div>
        <Button type="submit" disabled={pending}>
          <PendingLabel pending={pending} busy="Enregistrement…">
            Enregistrer
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  note,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  /** Un repère sous le champ, pour les valeurs qu'on ne sait pas estimer de tête. */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={htmlFor}>
        {label}
        {hint ? <span className="type-caption font-normal text-text-secondary">{hint}</span> : null}
      </Label>
      {children}
      {note ? <p className="type-caption text-text-secondary">{note}</p> : null}
    </div>
  );
}

/**
 * Le pays d'une source, dans la liste fermée. Une valeur historique absente
 * de la liste reste proposée sous son code : changer de liste ne doit jamais
 * changer une campagne en silence.
 */
function CountrySelect({ id, name, defaultValue }: { id: string; name: string; defaultValue: string }) {
  const options = isKnownCountry(defaultValue)
    ? COUNTRIES
    : [...COUNTRIES, { code: defaultValue, name: countryName(defaultValue) }];
  return (
    <NativeSelect id={id} name={name} defaultValue={defaultValue}>
      {options.map((country) => (
        <option key={country.code} value={country.code}>
          {country.name}
        </option>
      ))}
    </NativeSelect>
  );
}

/**
 * Les pays acceptés par les filtres, une case par pays. Un code coché que la
 * liste ne connaît pas est ajouté à la fin, coché, sous son code — rien de
 * ce que la campagne porte ne se perd.
 */
function CountryChecklist({ name, checked }: { name: string; checked: string[] }) {
  const selected = new Set(checked.map((code) => code.toUpperCase()));
  const extras = [...selected].filter((code) => !isKnownCountry(code));
  const entries = [...COUNTRIES, ...extras.map((code) => ({ code, name: countryName(code) }))];
  return (
    <fieldset className="grid gap-1 sm:col-span-2">
      <legend className="type-label mb-1">Pays acceptés</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
        {entries.map((country) => (
          <label
            key={country.code}
            className="type-caption flex min-w-0 items-center gap-2 text-text-primary"
          >
            <input
              type="checkbox"
              name={name}
              value={country.code}
              defaultChecked={selected.has(country.code)}
              className="size-4 shrink-0 accent-[var(--accent-ink)]"
            />
            <span className="truncate">{country.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Une liste ordonnée d'options activables — les sources de décisionnaire,
 * les fournisseurs d'adresse. L'ordre part dans un champ caché, l'activation
 * dans une case par entrée ; les flèches réordonnent sans quitter le clavier.
 */
function OrderedToggles({
  legend,
  orderName,
  prefix,
  entries,
}: {
  legend: string;
  orderName: string;
  prefix: string;
  entries: { key: DiscoverySourceKey | EmailProviderKey; enabled: boolean; label: string; available: boolean }[];
}) {
  const [order, setOrder] = useState(entries.map((entry) => entry.key));
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  function move(index: number, delta: -1 | 1) {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <fieldset className="grid gap-1">
      <legend className="type-label mb-1">{legend}</legend>
      <input type="hidden" name={orderName} value={order.join(",")} />
      <ol className="divide-y divide-border rounded-md border border-border">
        {order.map((key, index) => {
          const entry = byKey.get(key)!;
          return (
            <li key={key} className="flex items-center gap-2 px-3 py-2">
              <label className="type-caption flex min-w-0 flex-1 items-center gap-2 text-text-primary">
                <input
                  type="checkbox"
                  name={`${prefix}_${key}`}
                  defaultChecked={entry.enabled}
                  className="size-4 accent-[var(--accent-ink)]"
                />
                <span className="truncate">{entry.label}</span>
                {!entry.available ? (
                  <span className="type-caption text-warning-ink">clé absente</span>
                ) : null}
              </label>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Monter ${entry.label}`}
                className={cn(
                  "focus-visible:ring-ring rounded-sm p-1 text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40",
                )}
              >
                <ArrowUp className="size-3.5" strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === order.length - 1}
                aria-label={`Descendre ${entry.label}`}
                className="focus-visible:ring-ring rounded-sm p-1 text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
              >
                <ArrowDown className="size-3.5" strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}
