"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addReactionAction,
  createCommentAction,
  publishPostAction,
  runStressTestAction,
  saveDraftAction,
} from "@/app/actions";
import type {
  CommentRecord,
  DashboardStats,
  DraftRecord,
  FeedSnapshot,
  Persona,
  PersonalizedInsight,
  PopularPost,
  PostRecord,
  StressScenario,
} from "@/lib/types";

type ClientComment = CommentRecord & {
  clientStatus?: "sending" | "failed";
  clientId?: string;
};

type ClientPost = Omit<PostRecord, "comments"> & {
  comments: ClientComment[];
  optimisticStatus?: "publishing";
  clientId?: string;
};

type CommentComposerState = Record<number, { authorName: string; body: string; role: Persona }>;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function initialCommentState(posts: PostRecord[]): CommentComposerState {
  return Object.fromEntries(
    posts.map((post) => [
      post.id,
      {
        authorName: "Live Viewer",
        body: "",
        role: "viewer" as Persona,
      },
    ]),
  );
}

function toClientPosts(posts: PostRecord[]): ClientPost[] {
  return posts.map((post) => ({
    ...post,
    comments: post.comments.map((comment) => ({ ...comment })),
  }));
}

function mergePosts(currentPosts: ClientPost[], serverPosts: PostRecord[]) {
  const optimisticPosts = currentPosts.filter((post) => post.optimisticStatus === "publishing");
  const localCommentMap = new Map<number, ClientComment[]>();

  for (const post of currentPosts) {
    if (typeof post.id !== "number" || Number.isNaN(post.id)) {
      continue;
    }

    const localComments = post.comments.filter(
      (comment) => comment.clientStatus === "sending" || comment.clientStatus === "failed",
    );

    if (localComments.length > 0) {
      localCommentMap.set(post.id, localComments);
    }
  }

  const merged = serverPosts.map((post) => ({
    ...post,
    comments: [...(localCommentMap.get(post.id) ?? []), ...post.comments],
  }));

  return [...optimisticPosts, ...merged];
}

function personaLabel(persona: Persona) {
  if (persona === "creator") {
    return "Creator";
  }

  if (persona === "admin") {
    return "Admin";
  }

  return "Viewer";
}

export function PlatformShell({
  activePersona,
  initialDraft,
  initialPosts,
  initialStats,
  personalizedInsights,
  popularPosts,
}: {
  activePersona: Persona;
  initialDraft: DraftRecord;
  initialPosts: PostRecord[];
  initialStats: DashboardStats;
  personalizedInsights: PersonalizedInsight[];
  popularPosts: PopularPost[];
}) {
  const router = useRouter();
  const viewerId = `${activePersona}-demo-viewer`;
  const [posts, setPosts] = useState<ClientPost[]>(() => toClientPosts(initialPosts));
  const [stats, setStats] = useState(initialStats);
  const [draft, setDraft] = useState({
    title: initialDraft.title,
    body: initialDraft.body,
  });
  const [commentForms, setCommentForms] = useState<CommentComposerState>(() =>
    initialCommentState(initialPosts),
  );
  const [draftStatus, setDraftStatus] = useState<"saved" | "saving" | "error">("saved");
  const [banner, setBanner] = useState<{ tone: "neutral" | "error"; message: string } | null>(null);
  const [syncLabel, setSyncLabel] = useState("Live sync armed");
  const [likeCooldowns, setLikeCooldowns] = useState<Record<number, boolean>>({});
  const [runningScenario, setRunningScenario] = useState<StressScenario | null>(null);
  const lastSavedDraftRef = useRef(JSON.stringify(draft));
  const saveSequenceRef = useRef(0);
  const saveDraftNowRef = useRef<(nextDraft: typeof draft) => Promise<void>>(async () => {});
  const syncFromServerRef = useRef<() => Promise<void>>(async () => {});
  const deferredBody = useDeferredValue(draft.body);

  useEffect(() => {
    setPosts((current) => mergePosts(current, initialPosts));
    setStats(initialStats);
    setCommentForms((current) => ({
      ...initialCommentState(initialPosts),
      ...current,
    }));
  }, [initialPosts, initialStats]);

  saveDraftNowRef.current = async (nextDraft: typeof draft) => {
    const sequence = ++saveSequenceRef.current;
    const result = await saveDraftAction(nextDraft);

    if (sequence !== saveSequenceRef.current) {
      return;
    }

    if (result.status === "success") {
      lastSavedDraftRef.current = JSON.stringify(nextDraft);
      setDraftStatus("saved");
    } else {
      setDraftStatus("error");
    }
  };

  useEffect(() => {
    const serialized = JSON.stringify(draft);

    if (serialized === lastSavedDraftRef.current) {
      return;
    }

    setDraftStatus("saving");
    const timeoutId = window.setTimeout(() => {
      void saveDraftNowRef.current(draft);
    }, 850);

    return () => window.clearTimeout(timeoutId);
  }, [draft]);

  syncFromServerRef.current = async () => {
    try {
      const response = await fetch(`/api/feed?viewerId=${viewerId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const snapshot = (await response.json()) as FeedSnapshot;
      setPosts((current) => mergePosts(current, snapshot.posts));
      setStats(snapshot.stats);
      setSyncLabel(`Synced ${formatTime(snapshot.syncedAt)}`);
    } catch {
      setSyncLabel("Sync paused");
    }
  };

  useEffect(() => {
    void syncFromServerRef.current();
    const intervalId = window.setInterval(() => {
      void syncFromServerRef.current();
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [viewerId]);

  const summary = useMemo(
    () => [
      { label: "Posts", value: stats.totalPosts },
      { label: "Comments", value: stats.totalComments },
      { label: "Reactions", value: stats.totalReactions },
    ],
    [stats],
  );

  async function handlePublish() {
    const trimmedTitle = draft.title.trim();
    const trimmedBody = draft.body.trim();
    const optimisticId = `temp-${Date.now()}`;

    const optimisticPost: ClientPost = {
      id: Number.NaN,
      clientId: optimisticId,
      optimisticStatus: "publishing",
      title: trimmedTitle || "Untitled post",
      body: trimmedBody || "Draft content is being prepared.",
      authorName: "Studio Creator",
      role: "creator",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
      viewerLiked: false,
      comments: [],
    };

    setPosts((current) => [optimisticPost, ...current]);
    setBanner({
      tone: "neutral",
      message: "Publishing instantly. The optimistic card is already in the feed.",
    });

    const result = await publishPostAction({
      title: trimmedTitle,
      body: trimmedBody,
      authorName: "Studio Creator",
      role: "creator",
    });

    if (result.status === "success") {
      setPosts((current) => {
        const withoutOptimistic = current.filter((post) => post.clientId !== optimisticId);
        return [result.data, ...withoutOptimistic];
      });
      setDraft({ title: "", body: "" });
      lastSavedDraftRef.current = JSON.stringify({ title: "", body: "" });
      setDraftStatus("saved");
      setBanner({ tone: "neutral", message: result.message });
      startTransition(() => router.refresh());
      return;
    }

    setPosts((current) => current.filter((post) => post.clientId !== optimisticId));
    setBanner({ tone: "error", message: result.message });
  }

  async function handleCommentSubmit(postId: number) {
    const form = commentForms[postId];

    if (!form || form.body.trim().length === 0) {
      return;
    }

    const optimisticId = `comment-${postId}-${Date.now()}`;
    const optimisticComment: ClientComment = {
      id: Number.NaN,
      clientId: optimisticId,
      postId,
      authorName: form.authorName || personaLabel(activePersona),
      role: form.role,
      body: form.body,
      createdAt: new Date().toISOString(),
      clientStatus: "sending",
    };

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              commentCount: post.commentCount + 1,
              comments: [optimisticComment, ...post.comments],
            }
          : post,
      ),
    );
    setCommentForms((current) => ({
      ...current,
      [postId]: { ...current[postId], body: "" },
    }));

    const result = await createCommentAction({
      postId,
      authorName: optimisticComment.authorName,
      role: optimisticComment.role,
      body: optimisticComment.body,
    });

    if (result.status === "success") {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.map((comment) =>
                  comment.clientId === optimisticId ? result.data : comment,
                ),
              }
            : post,
        ),
      );
      startTransition(() => router.refresh());
      return;
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((comment) =>
                comment.clientId === optimisticId
                  ? { ...comment, clientStatus: "failed" }
                  : comment,
              ),
            }
          : post,
      ),
    );
    setBanner({ tone: "error", message: result.message });
  }

  async function retryComment(postId: number, comment: ClientComment) {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((item) =>
                item.clientId === comment.clientId ? { ...item, clientStatus: "sending" } : item,
              ),
            }
          : post,
      ),
    );

    const result = await createCommentAction({
      postId,
      authorName: comment.authorName,
      role: comment.role,
      body: comment.body,
    });

    if (result.status === "success") {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.map((item) =>
                  item.clientId === comment.clientId ? result.data : item,
                ),
              }
            : post,
        ),
      );
      startTransition(() => router.refresh());
      return;
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((item) =>
                item.clientId === comment.clientId ? { ...item, clientStatus: "failed" } : item,
              ),
            }
          : post,
      ),
    );
  }

  async function handleLike(postId: number) {
    const target = posts.find((post) => post.id === postId);

    if (!target || target.viewerLiked || likeCooldowns[postId]) {
      return;
    }

    setLikeCooldowns((current) => ({ ...current, [postId]: true }));
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, viewerLiked: true, likeCount: post.likeCount + 1 }
          : post,
      ),
    );

    const result = await addReactionAction({ postId, viewerId });

    setTimeout(() => {
      setLikeCooldowns((current) => ({ ...current, [postId]: false }));
    }, 900);

    if (result.status === "success") {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, likeCount: result.likeCount } : post,
        ),
      );
      startTransition(() => router.refresh());
      return;
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              likeCount: result.likeCount || Math.max(0, post.likeCount - 1),
              viewerLiked: false,
            }
          : post,
      ),
    );
    setBanner({ tone: "error", message: result.message });
  }

  async function runScenario(scenario: StressScenario) {
    setRunningScenario(scenario);
    const result = await runStressTestAction(scenario);
    setRunningScenario(null);
    setBanner({
      tone: result.status === "success" ? "neutral" : "error",
      message: result.message,
    });
    startTransition(() => router.refresh());
    void syncFromServerRef.current();
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Task 4 • AI Content Collaboration Platform</span>
          <h1>Optimistic UX, server-first data flow, and realtime feel in one premium demo.</h1>
          <p>
            Publish lands instantly, drafts auto-save in the background, comments retry cleanly,
            likes are spam-protected, and the feed blends SSR with cached ranking.
          </p>

          <div className="hero-actions">
            <Link href="?persona=creator" className={activePersona === "creator" ? "chip active" : "chip"}>
              Creator view
            </Link>
            <Link href="?persona=viewer" className={activePersona === "viewer" ? "chip active" : "chip"}>
              Viewer view
            </Link>
            <Link href="?persona=admin" className={activePersona === "admin" ? "chip active" : "chip"}>
              Admin view
            </Link>
          </div>
        </div>

        <div className="hero-side">
          <div className="glass-card">
            <span className="mini-label">Realtime feel</span>
            <strong>{syncLabel}</strong>
            <p>Polling refreshes content without a full page reload, so new posts and comments appear naturally.</p>
          </div>
          <div className="glass-card">
            <span className="mini-label">Draft heartbeat</span>
            <strong>{draftStatus === "saving" ? "Saving..." : draftStatus === "saved" ? "Saved" : "Retrying soon"}</strong>
            <p>Manual save is gone. Background persistence protects momentum while writing.</p>
          </div>
        </div>
      </section>

      {banner ? (
        <section className={`status-strip ${banner.tone === "error" ? "error" : ""}`}>{banner.message}</section>
      ) : null}

      <section className="summary-grid">
        {summary.map((item) => (
          <article key={item.label} className="summary-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
        <article className="summary-card">
          <span>Draft freshness</span>
          <strong>{stats.activeDraftAgeLabel}</strong>
        </article>
      </section>

      <section className="workspace-grid">
        <section className="studio-column">
          <article className="panel">
            <div className="section-head">
              <span className="mini-label">Instant publish</span>
              <h2>Creator studio</h2>
            </div>
            <div className="field-stack">
              <label className="field">
                <span>Post title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ship an update, note, or announcement"
                />
              </label>
              <label className="field">
                <span>Draft body</span>
                <textarea
                  value={draft.body}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Type here. Add #fail to demo rollback."
                  rows={9}
                />
              </label>
            </div>

            <div className="composer-actions">
              <button className="primary-button" type="button" onClick={() => void handlePublish()}>
                Publish now
              </button>
              <span className={`save-pill ${draftStatus}`}>
                {draftStatus === "saving" ? "Saving..." : draftStatus === "saved" ? "Saved" : "Retrying"}
              </span>
            </div>

            <div className="preview-card">
              <span className="mini-label">Live preview</span>
              <strong>{draft.title.trim() || "Preview title"}</strong>
              <p>{deferredBody.trim() || "Your content preview updates instantly while auto-save runs in the background."}</p>
            </div>
          </article>

          <article className="panel">
            <div className="section-head">
              <span className="mini-label">Stress test</span>
              <h2>Consistency checks</h2>
            </div>
            <div className="stress-grid">
              <button className="ghost-button" type="button" disabled={runningScenario !== null} onClick={() => void runScenario("post-burst")}>
                {runningScenario === "post-burst" ? "Running..." : "5-user post burst"}
              </button>
              <button className="ghost-button" type="button" disabled={runningScenario !== null} onClick={() => void runScenario("comment-storm")}>
                {runningScenario === "comment-storm" ? "Running..." : "10-user comment storm"}
              </button>
              <button className="ghost-button" type="button" disabled={runningScenario !== null} onClick={() => void runScenario("like-spam")}>
                {runningScenario === "like-spam" ? "Running..." : "Like spam simulation"}
              </button>
            </div>
            <p className="panel-copy">
              These actions generate concurrent-feeling mutations so the UI can prove rollback,
              dedupe, cached ranking, and feed sync under pressure.
            </p>
          </article>
        </section>

        <section className="feed-column">
          <article className="panel">
            <div className="section-head">
              <span className="mini-label">SSR latest feed</span>
              <h2>Live content feed</h2>
            </div>

            <div className="post-stack">
              {posts.map((post) => (
                <article key={post.clientId ?? String(post.id)} className="post-card">
                  <div className="post-topline">
                    <div>
                      <strong>{post.title}</strong>
                      <div className="meta-line">
                        <span>{post.authorName}</span>
                        <span>{personaLabel(post.role)}</span>
                        <span>{formatTime(post.createdAt)}</span>
                        {post.optimisticStatus ? <span>Publishing...</span> : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`like-button ${post.viewerLiked ? "active" : ""}`}
                      disabled={typeof post.id !== "number" || Number.isNaN(post.id) || likeCooldowns[post.id]}
                      onClick={() => typeof post.id === "number" && !Number.isNaN(post.id) && void handleLike(post.id)}
                    >
                      {post.viewerLiked ? "Boosted" : "Boost"} {post.likeCount}
                    </button>
                  </div>

                  <p className="post-body">{post.body}</p>

                  <div className="comment-head">
                    <span>{post.commentCount} comments</span>
                    <span>Optimistic replies stay visible even during retries.</span>
                  </div>

                  <div className="comment-form">
                    <input
                      value={commentForms[post.id]?.authorName ?? "Live Viewer"}
                      onChange={(event) =>
                        setCommentForms((current) => ({
                          ...current,
                          [post.id]: {
                            ...(current[post.id] ?? { authorName: "", body: "", role: "viewer" }),
                            authorName: event.target.value,
                          },
                        }))
                      }
                      placeholder="Name"
                      disabled={typeof post.id !== "number" || Number.isNaN(post.id)}
                    />
                    <select
                      value={commentForms[post.id]?.role ?? "viewer"}
                      onChange={(event) =>
                        setCommentForms((current) => ({
                          ...current,
                          [post.id]: {
                            ...(current[post.id] ?? { authorName: "", body: "", role: "viewer" }),
                            role: event.target.value as Persona,
                          },
                        }))
                      }
                      disabled={typeof post.id !== "number" || Number.isNaN(post.id)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="creator">Creator</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input
                      value={commentForms[post.id]?.body ?? ""}
                      onChange={(event) =>
                        setCommentForms((current) => ({
                          ...current,
                          [post.id]: {
                            ...(current[post.id] ?? { authorName: "", body: "", role: "viewer" }),
                            body: event.target.value,
                          },
                        }))
                      }
                      placeholder="Reply instantly. Add #fail to test retry."
                      disabled={typeof post.id !== "number" || Number.isNaN(post.id)}
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={typeof post.id !== "number" || Number.isNaN(post.id)}
                      onClick={() => typeof post.id === "number" && !Number.isNaN(post.id) && void handleCommentSubmit(post.id)}
                    >
                      Send
                    </button>
                  </div>

                  <div className="comment-stack">
                    {post.comments.map((comment) => (
                      <div key={comment.clientId ?? comment.id} className="comment-card">
                        <div className="comment-topline">
                          <strong>{comment.authorName}</strong>
                          <span>{personaLabel(comment.role)}</span>
                          <span>
                            {comment.clientStatus === "sending"
                              ? "Sending..."
                              : comment.clientStatus === "failed"
                                ? "Failed"
                                : formatTime(comment.createdAt)}
                          </span>
                        </div>
                        <p>{comment.body}</p>
                        {comment.clientStatus === "failed" && typeof post.id === "number" ? (
                          <button type="button" className="retry-link" onClick={() => void retryComment(post.id, comment)}>
                            Retry send
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <aside className="insight-column">
          <article className="panel">
            <div className="section-head">
              <span className="mini-label">Cache hybrid</span>
              <h2>Popular posts</h2>
            </div>
            <div className="mini-stack">
              {popularPosts.map((post) => (
                <div key={post.id} className="rank-card">
                  <strong>{post.title}</strong>
                  <span>{post.authorName}</span>
                  <span>Score {post.score} • {post.likeCount} boosts • {post.commentCount} comments</span>
                </div>
              ))}
            </div>
            <p className="panel-copy">
              This list is cached for 60 seconds so expensive ranking stays cheap while the latest
              feed keeps its SSR freshness.
            </p>
          </article>

          <article className="panel">
            <div className="section-head">
              <span className="mini-label">Server-first persona feed</span>
              <h2>{personaLabel(activePersona)} insights</h2>
            </div>
            <div className="mini-stack">
              {personalizedInsights.map((insight) => (
                <div key={insight.id} className="rank-card">
                  <span className="mini-label">{insight.label}</span>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-head">
              <span className="mini-label">Architecture + UX</span>
              <h2>Why this feels premium</h2>
            </div>
            <div className="qa-stack">
              <div className="qa-card">
                <strong>1. Why optimistic comments matter</strong>
                <p>Commenting is emotional and social. Instant insertion removes hesitation and makes participation feel acknowledged immediately.</p>
              </div>
              <div className="qa-card">
                <strong>2. Why draft auto-save is powerful</strong>
                <p>It preserves flow. Writers stay in the idea, not in a save ritual, while the system quietly protects their work.</p>
              </div>
              <div className="qa-card">
                <strong>3. SSR vs cache decision</strong>
                <p>Latest posts are server-rendered fresh on request. Popular ranking is cached for 60 seconds because it is heavier and less time-sensitive.</p>
              </div>
              <div className="qa-card">
                <strong>4. How rollback works</strong>
                <p>Optimistic cards render first. If the server rejects the mutation, the temporary item is removed or marked failed, then the user gets a clear message or retry path.</p>
              </div>
              <div className="qa-card">
                <strong>5. Retention impact</strong>
                <p>Fast feedback creates momentum. Users publish more, comment more, and trust the workspace because it feels responsive and safe.</p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
