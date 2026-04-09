import {
  revalidateTag,
  unstable_cache,
  unstable_noStore as noStore,
} from "next/cache";
import { getDb } from "@/lib/db";
import type {
  CommentInput,
  CommentRecord,
  DashboardStats,
  DraftInput,
  DraftRecord,
  FeedSnapshot,
  Persona,
  PersonalizedInsight,
  PopularPost,
  PostRecord,
  PublishInput,
  StressScenario,
} from "@/lib/types";

function mapComment(row: Record<string, unknown>): CommentRecord {
  return {
    id: Number(row.id),
    postId: Number(row.post_id),
    authorName: String(row.author_name),
    role: String(row.role) as Persona,
    body: String(row.body),
    createdAt: String(row.created_at),
  };
}

function mapDraft(row: Record<string, unknown>): DraftRecord {
  return {
    id: Number(row.id),
    title: String(row.title),
    body: String(row.body),
    updatedAt: String(row.updated_at),
  };
}

function mapPost(row: Record<string, unknown>): Omit<PostRecord, "comments"> {
  return {
    id: Number(row.id),
    title: String(row.title),
    body: String(row.body),
    authorName: String(row.author_name),
    role: String(row.role) as Persona,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    viewerLiked: Boolean(row.viewer_liked),
  };
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldSimulateFailure(...values: string[]) {
  return values.some((value) => value.toLowerCase().includes("#fail"));
}

function relativeAgeLabel(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

function withComments(posts: Omit<PostRecord, "comments">[], viewerId: string) {
  if (posts.length === 0) {
    return [] as PostRecord[];
  }

  const db = getDb();
  const ids = posts.map((post) => post.id);
  const placeholders = ids.map(() => "?").join(", ");
  const commentRows = db
    .prepare(
      `
        SELECT id, post_id, author_name, role, body, created_at
        FROM comments
        WHERE post_id IN (${placeholders})
        ORDER BY datetime(created_at) DESC, id DESC
      `,
    )
    .all(...ids) as Array<Record<string, unknown>>;

  const commentsByPost = new Map<number, CommentRecord[]>();

  for (const row of commentRows) {
    const comment = mapComment(row);
    const list = commentsByPost.get(comment.postId) ?? [];
    if (list.length < 5) {
      list.push(comment);
    }
    commentsByPost.set(comment.postId, list);
  }

  return posts.map((post) => ({
    ...post,
    viewerLiked: viewerId ? post.viewerLiked : false,
    comments: commentsByPost.get(post.id) ?? [],
  }));
}

export async function createPost(input: PublishInput) {
  const db = getDb();
  const row = db
    .prepare(
      `
        INSERT INTO posts (title, body, author_name, role, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        RETURNING id, title, body, author_name, role, created_at, updated_at
      `,
    )
    .get(input.title, input.body, input.authorName, input.role) as Record<string, unknown>;

  db.prepare(
    `
      UPDATE drafts
      SET title = '', body = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `,
  ).run();

  revalidateTag("popular-posts");

  const post = mapPost({
    ...row,
    like_count: 0,
    comment_count: 0,
    viewer_liked: 0,
  });

  return {
    ...post,
    comments: [],
  } satisfies PostRecord;
}

export async function upsertDraft(input: DraftInput) {
  const db = getDb();
  const row = db
    .prepare(
      `
        INSERT INTO drafts (id, title, body, updated_at)
        VALUES (1, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          body = excluded.body,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, title, body, updated_at
      `,
    )
    .get(input.title, input.body) as Record<string, unknown>;

  return mapDraft(row);
}

export async function getDraft() {
  noStore();
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT id, title, body, updated_at
        FROM drafts
        WHERE id = 1
      `,
    )
    .get() as Record<string, unknown>;

  return mapDraft(row);
}

export async function createComment(input: CommentInput) {
  const db = getDb();
  const row = db
    .prepare(
      `
        INSERT INTO comments (post_id, author_name, role, body)
        VALUES (?, ?, ?, ?)
        RETURNING id, post_id, author_name, role, body, created_at
      `,
    )
    .get(input.postId, input.authorName, input.role, input.body) as Record<string, unknown>;

  db.prepare(
    `
      UPDATE posts
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(input.postId);

  revalidateTag("popular-posts");
  return mapComment(row);
}

export async function addReaction(postId: number, viewerId: string) {
  const db = getDb();

  try {
    db.prepare(
      `
        INSERT INTO reactions (post_id, viewer_id)
        VALUES (?, ?)
      `,
    ).run(postId, viewerId);
  } catch {
    const currentCount = Number(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM reactions WHERE post_id = ?")
          .get(postId) as { count: number }
      ).count,
    );

    return {
      accepted: false,
      likeCount: currentCount,
    };
  }

  revalidateTag("popular-posts");

  const likeCount = Number(
    (
      db
        .prepare("SELECT COUNT(*) AS count FROM reactions WHERE post_id = ?")
        .get(postId) as { count: number }
    ).count,
  );

  return {
    accepted: true,
    likeCount,
  };
}

export async function getLatestPosts(viewerId: string, limit = 6) {
  noStore();
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          p.id,
          p.title,
          p.body,
          p.author_name,
          p.role,
          p.created_at,
          p.updated_at,
          (
            SELECT COUNT(*)
            FROM reactions r
            WHERE r.post_id = p.id
          ) AS like_count,
          (
            SELECT COUNT(*)
            FROM comments c
            WHERE c.post_id = p.id
          ) AS comment_count,
          EXISTS(
            SELECT 1
            FROM reactions rv
            WHERE rv.post_id = p.id AND rv.viewer_id = ?
          ) AS viewer_liked
        FROM posts p
        ORDER BY datetime(p.created_at) DESC, p.id DESC
        LIMIT ?
      `,
    )
    .all(viewerId, limit) as Array<Record<string, unknown>>;

  return withComments(rows.map(mapPost), viewerId);
}

const getPopularPostsInternal = unstable_cache(
  async (limit: number): Promise<PopularPost[]> => {
    const db = getDb();
    const rows = db
      .prepare(
        `
          SELECT
            p.id,
            p.title,
            p.author_name,
            (
              SELECT COUNT(*)
              FROM reactions r
              WHERE r.post_id = p.id
            ) AS like_count,
            (
              SELECT COUNT(*)
              FROM comments c
              WHERE c.post_id = p.id
            ) AS comment_count
          FROM posts p
          ORDER BY (like_count * 2 + comment_count * 3) DESC, datetime(p.created_at) DESC
          LIMIT ?
        `,
      )
      .all(limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      authorName: String(row.author_name),
      likeCount: Number(row.like_count),
      commentCount: Number(row.comment_count),
      score: Number(row.like_count) * 2 + Number(row.comment_count) * 3,
    }));
  },
  ["popular-posts"],
  {
    revalidate: 60,
    tags: ["popular-posts"],
  },
);

export async function getPopularPosts(limit = 4) {
  return getPopularPostsInternal(limit);
}

export async function getPersonalizedInsights(persona: Persona): Promise<PersonalizedInsight[]> {
  noStore();
  const db = getDb();
  const mostDiscussed = db
    .prepare(
      `
        SELECT p.title, COUNT(c.id) AS count
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.id
        GROUP BY p.id
        ORDER BY count DESC, datetime(p.created_at) DESC
        LIMIT 1
      `,
    )
    .get() as { title?: string; count?: number };

  const latestCreator = db
    .prepare(
      `
        SELECT title, updated_at
        FROM posts
        WHERE role = 'creator'
        ORDER BY datetime(updated_at) DESC, id DESC
        LIMIT 1
      `,
    )
    .get() as { title?: string; updated_at?: string };

  const cards: Record<Persona, PersonalizedInsight[]> = {
    creator: [
      {
        id: "creator-1",
        label: "Creator lens",
        title: latestCreator.title
          ? `Newest creator post: ${latestCreator.title}`
          : "Your publishing lane is ready",
        detail: latestCreator.updated_at
          ? `Freshest creator activity landed ${relativeAgeLabel(latestCreator.updated_at)}.`
          : "Start a draft to trigger auto-save and instant publish.",
      },
      {
        id: "creator-2",
        label: "Engagement",
        title: mostDiscussed.title
          ? `Most discussed right now: ${mostDiscussed.title}`
          : "No discussion yet",
        detail: "Comments are the fastest feedback loop for writers because readers see their input reflected immediately.",
      },
    ],
    viewer: [
      {
        id: "viewer-1",
        label: "Viewer lens",
        title: mostDiscussed.title
          ? `Join the conversation on ${mostDiscussed.title}`
          : "Fresh content is about to land",
        detail: "SSR loads the newest posts first so readers never wait on a client waterfall.",
      },
      {
        id: "viewer-2",
        label: "Retention",
        title: "Fast feedback keeps the feed sticky",
        detail: "Optimistic comments and likes make participation feel instant, which increases repeat actions.",
      },
    ],
    admin: [
      {
        id: "admin-1",
        label: "Admin lens",
        title: `Conversation volume: ${mostDiscussed.count ?? 0} replies on the busiest thread`,
        detail: "The fake realtime sync lets moderation and operations track changes without hard refreshes.",
      },
      {
        id: "admin-2",
        label: "Reliability",
        title: "Rollback protects trust",
        detail: "Failed publishes and failed comments disappear or retry cleanly so data stays consistent.",
      },
    ],
  };

  return cards[persona];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  noStore();
  const db = getDb();
  const counts = db
    .prepare(
      `
        SELECT
          (SELECT COUNT(*) FROM posts) AS total_posts,
          (SELECT COUNT(*) FROM comments) AS total_comments,
          (SELECT COUNT(*) FROM reactions) AS total_reactions
      `,
    )
    .get() as Record<string, unknown>;

  const draft = await getDraft();

  return {
    totalPosts: Number(counts.total_posts),
    totalComments: Number(counts.total_comments),
    totalReactions: Number(counts.total_reactions),
    activeDraftAgeLabel: relativeAgeLabel(draft.updatedAt),
  };
}

export async function getFeedSnapshot(viewerId: string): Promise<FeedSnapshot> {
  const [posts, stats] = await Promise.all([getLatestPosts(viewerId), getDashboardStats()]);
  return {
    posts,
    stats,
    syncedAt: new Date().toISOString(),
  };
}

export async function runStressScenario(scenario: StressScenario) {
  const db = getDb();

  if (scenario === "post-burst") {
    for (let index = 0; index < 5; index += 1) {
      db.prepare(
        `
          INSERT INTO posts (title, body, author_name, role, updated_at)
          VALUES (?, ?, ?, 'creator', CURRENT_TIMESTAMP)
        `,
      ).run(
        `Burst post ${index + 1}`,
        "Five creators publishing at nearly the same time should still keep the feed stable.",
        `Creator ${index + 1}`,
      );
    }

    revalidateTag("popular-posts");
    return "Inserted 5 creator posts in sequence to mimic simultaneous publishing.";
  }

  const topPosts = db
    .prepare(
      `
        SELECT id
        FROM posts
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 3
      `,
    )
    .all() as Array<{ id: number }>;

  if (scenario === "comment-storm") {
    for (let index = 0; index < 10; index += 1) {
      const target = topPosts[index % Math.max(topPosts.length, 1)];
      if (!target) {
        break;
      }

      db.prepare(
        `
          INSERT INTO comments (post_id, author_name, role, body)
          VALUES (?, ?, 'viewer', ?)
        `,
      ).run(target.id, `Viewer ${index + 1}`, `Comment storm message ${index + 1}`);
    }

    revalidateTag("popular-posts");
    return "Injected 10 viewer comments across the newest posts.";
  }

  for (let index = 0; index < 18; index += 1) {
    const target = topPosts[index % Math.max(topPosts.length, 1)];
    if (!target) {
      break;
    }

    try {
      db.prepare(
        `
          INSERT INTO reactions (post_id, viewer_id)
          VALUES (?, ?)
        `,
      ).run(target.id, `spam-viewer-${index % 6}`);
    } catch {
      continue;
    }
  }

  revalidateTag("popular-posts");
  return "Ran a like spam simulation with duplicate viewers. Unique constraints kept counts consistent.";
}

export async function simulatePublishFlow(input: PublishInput) {
  if (shouldSimulateFailure(input.title, input.body)) {
    throw new Error("Simulated publish failure");
  }

  await pause(1200);
  return createPost(input);
}

export async function simulateDraftSave(input: DraftInput) {
  await pause(700);
  return upsertDraft(input);
}

export async function simulateCommentFlow(input: CommentInput) {
  if (shouldSimulateFailure(input.body)) {
    throw new Error("Simulated comment failure");
  }

  await pause(800);
  return createComment(input);
}

export async function simulateReaction(postId: number, viewerId: string) {
  await pause(350);
  return addReaction(postId, viewerId);
}
