import {
  Banknote,
  Bookmark,
  Briefcase,
  Building2,
  CircleCheck,
  DollarSign,
  Eye,
  Flame,
  Heart,
  MessageCircle,
  MonitorPlay,
  MousePointerClick,
  Percent,
  Play,
  Repeat,
  Send,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { MetricId } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

/**
 * Le pictogramme d'une mesure, dans sa pastille.
 *
 * La tuile portait un libellé et un chiffre, rien d'autre — au motif que dix
 * pictogrammes côte à côte font un mur de symboles. C'est vrai quand ils sont
 * posés **au-dessus** du chiffre, en concurrence avec lui ; ça ne l'est plus
 * quand ils tiennent la colonne de gauche, où l'œil les balaie pour retrouver
 * une carte sans lire.
 *
 * `Record<MetricId, …>` et non un objet libre : ajouter une mesure sans lui
 * donner d'icône casse la compilation, ce qui est le garde-fou voulu.
 */
const METRIC_ICONS: Record<MetricId, LucideIcon> = {
  impressions: Eye,
  clicks: MousePointerClick,
  cpa: Target,
  purchases: ShoppingBag,
  roas: TrendingUp,
  cpm: DollarSign,
  ctr: Percent,
  spend: Wallet,
  earn: Banknote,
  landingPageViews: MonitorPlay,
  cpl: UserPlus,
  cpc: MousePointerClick,
  comments: MessageCircle,
  saves: Bookmark,
  reach: Users,
  frequency: Repeat,
  shares: Send,
  likes: Heart,
  videoViews: Play,
  videoCompletions: CircleCheck,
  interactions: Sparkles,
  /* La page elle-même, pas son contenu : une porte, et l'onglet Emplois
     qu'on vient y pousser. */
  pageViews: Building2,
  jobsPageViews: Briefcase,
  engagements: Sparkles,
  engagementRateWithClicks: Flame,
  engagementRate: Sparkles,
};

/**
 * La pastille : encre verte foncée sur mint, cerclée d'un filet clair.
 *
 * L'encre et non le vert vif — à cette taille, `--accent` tombe sous le seuil
 * de lisibilité sur mint. Et l'icône reste décorative : `aria-hidden`, toute
 * l'information est dans le libellé à côté.
 */
export function MetricIcon({
  metric,
  size = "md",
  className,
}: {
  metric: MetricId;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = METRIC_ICONS[metric];

  return (
    <span
      aria-hidden
      className={cn(
        "bg-accent-subtle ring-surface text-accent-ink flex shrink-0 items-center justify-center rounded-full ring-2",
        size === "md" ? "size-10" : "size-8",
        className,
      )}
    >
      <Icon
        className={size === "md" ? "size-4.5" : "size-4"}
        strokeWidth={1.75}
      />
    </span>
  );
}
