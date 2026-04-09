import type { TournamentId } from "@/lib/types";

export const TOURNAMENT_LABELS: Record<TournamentId, string> = {
  valorant: "Valorant Campus Clash",
  dota2: "Dota 2 Strategy Cup",
  fc25: "FC 25 Family Showdown",
};

export const TOURNAMENT_OPTIONS = Object.entries(TOURNAMENT_LABELS).map(
  ([value, label]) => ({
    value: value as TournamentId,
    label,
  }),
);
