import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.join(process.cwd(), "data");

mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "ai-content-collab.db");
const database = new DatabaseSync(dbPath);

database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author_name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    role TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    viewer_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, viewer_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );
`);

const postCount = Number(
  (database.prepare("SELECT COUNT(*) AS count FROM posts").get() as { count: number }).count,
);

if (postCount === 0) {
  database.exec(`
    INSERT OR IGNORE INTO drafts (id, title, body)
    VALUES (
      1,
      'Weekly launch note',
      'Outline the release note here. Auto-save keeps this draft safe while the creator continues typing.'
    );

    INSERT INTO posts (title, body, author_name, role)
    VALUES
      (
        'Premium onboarding pattern',
        'Short success states, instant reactions, and live collaboration cues make the workspace feel fast even before the network settles.',
        'Ari Studio',
        'creator'
      ),
      (
        'Viewer digest for today',
        'The feed highlights fresh posts first, then keeps popular content warm in cache so the page still feels light under load.',
        'Mira Feed',
        'viewer'
      ),
      (
        'Admin pulse board',
        'Operational teams can watch creation velocity, comment bursts, and reaction spikes without leaving the dashboard.',
        'Ops Lead',
        'admin'
      );
  `);

  const insertedPosts = database
    .prepare("SELECT id FROM posts ORDER BY id ASC")
    .all() as Array<{ id: number }>;

  if (insertedPosts.length >= 3) {
    database
      .prepare(
        `
          INSERT INTO comments (post_id, author_name, role, body)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(insertedPosts[0].id, "Nora", "viewer", "The instant publish cue feels polished.");
    database
      .prepare(
        `
          INSERT INTO comments (post_id, author_name, role, body)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(insertedPosts[0].id, "Kai", "admin", "Metrics card is useful for moderation.");
    database
      .prepare(
        `
          INSERT INTO comments (post_id, author_name, role, body)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(insertedPosts[1].id, "June", "creator", "Cache plus SSR is a good combo.");

    database
      .prepare(
        `
          INSERT INTO reactions (post_id, viewer_id)
          VALUES (?, ?), (?, ?), (?, ?), (?, ?), (?, ?)
        `,
      )
      .run(
        insertedPosts[0].id,
        "seed-viewer-1",
        insertedPosts[0].id,
        "seed-viewer-2",
        insertedPosts[1].id,
        "seed-viewer-3",
        insertedPosts[1].id,
        "seed-viewer-4",
        insertedPosts[2].id,
        "seed-viewer-5",
      );
  }
}

database.exec(`
  INSERT OR IGNORE INTO drafts (id, title, body)
  VALUES (1, '', '');
`);

export function getDb() {
  return database;
}
