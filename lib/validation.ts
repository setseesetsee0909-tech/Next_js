import type { RegistrationInput, SubmissionState, TournamentId } from "@/lib/types";

const TOURNAMENTS = new Set<TournamentId>(["valorant", "dota2", "fc25"]);

export function parseRegistrationFormData(formData: FormData): RegistrationInput {
  return {
    parentName: String(formData.get("parentName") ?? "").trim(),
    playerName: String(formData.get("playerName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    tournament: String(formData.get("tournament") ?? "").trim() as TournamentId,
  };
}

export function validateRegistrationInput(input: RegistrationInput): SubmissionState | null {
  const errors: Partial<Record<keyof RegistrationInput, string>> = {};

  if (input.parentName.length < 2) {
    errors.parentName = "Parent name must be at least 2 characters.";
  }

  if (input.playerName.length < 2) {
    errors.playerName = "Player name must be at least 2 characters.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!TOURNAMENTS.has(input.tournament)) {
    errors.tournament = "Choose a valid tournament.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      errors,
    };
  }

  return null;
}
