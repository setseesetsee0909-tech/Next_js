import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.join(process.cwd(), "data");

mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "tournament.db");
const database = new DatabaseSync(dbPath);

database.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_name TEXT NOT NULL,
    player_name TEXT NOT NULL,
    email TEXT NOT NULL,
    tournament TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export function getDb() {
  return database;
}
