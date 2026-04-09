export type TournamentId = "valorant" | "dota2" | "fc25";

export type RegistrationRecord = {
  id: number;
  parentName: string;
  playerName: string;
  email: string;
  tournament: TournamentId;
  createdAt: string;
};

export type RegistrationInput = {
  parentName: string;
  playerName: string;
  email: string;
  tournament: TournamentId;
};

export type SubmissionState =
  | {
      status: "idle";
      message: string | null;
      errors?: Partial<Record<keyof RegistrationInput, string>>;
      registration?: undefined;
    }
  | {
      status: "success";
      message: string;
      errors?: undefined;
      registration: RegistrationRecord;
    }
  | {
      status: "error";
      message: string;
      errors?: Partial<Record<keyof RegistrationInput, string>>;
      registration?: undefined;
    };

export type LeaderboardEntry = {
  tournament: TournamentId;
  count: number;
};
