import {
  revalidateTag,
  unstable_cache,
  unstable_noStore as noStore,
} from "next/cache";
import { getDb } from "@/lib/db";
import type {
  LeaderboardEntry,
  RegistrationInput,
  RegistrationRecord,
} from "@/lib/types";

function mapRegistration(row: Record<string, unknown>): RegistrationRecord {
  return {
    id: Number(row.id),
    parentName: String(row.parent_name),
    playerName: String(row.player_name),
    email: String(row.email),
    tournament: String(row.tournament) as RegistrationRecord["tournament"],
    createdAt: String(row.created_at),
  };
}

export async function createRegistration(input: RegistrationInput) {
  const db = getDb();
  const statement = db.prepare(`
    INSERT INTO registrations (parent_name, player_name, email, tournament)
    VALUES (?, ?, ?, ?)
    RETURNING id, parent_name, player_name, email, tournament, created_at
  `);

  const row = statement.get(
    input.parentName,
    input.playerName,
    input.email,
    input.tournament,
  ) as Record<string, unknown>;

  revalidateTag("leaderboard");
  return mapRegistration(row);
}

export async function getLiveRegistrations(): Promise<RegistrationRecord[]> {
  noStore();
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT id, parent_name, player_name, email, tournament, created_at
      FROM registrations
      ORDER BY datetime(created_at) DESC, id DESC
    `)
    .all() as Array<Record<string, unknown>>;

  return rows.map(mapRegistration);
}

const getCachedLeaderboardInternal = unstable_cache(
  async (): Promise<LeaderboardEntry[]> => {
    const db = getDb();
    const rows = db
      .prepare(`
        SELECT tournament, COUNT(*) AS count
        FROM registrations
        GROUP BY tournament
        ORDER BY count DESC, tournament ASC
      `)
      .all() as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      tournament: String(row.tournament) as LeaderboardEntry["tournament"],
      count: Number(row.count),
    }));
  },
  ["leaderboard"],
  {
    revalidate: 60,
    tags: ["leaderboard"],
  },
);

export async function getCachedLeaderboard() {
  return getCachedLeaderboardInternal();
}
