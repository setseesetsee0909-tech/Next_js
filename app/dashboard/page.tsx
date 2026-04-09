import Link from "next/link";
import { TOURNAMENT_LABELS } from "@/lib/constants";
import { getCachedLeaderboard, getLiveRegistrations } from "@/lib/registrations";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const [registrations, leaderboard] = await Promise.all([
    getLiveRegistrations(),
    getCachedLeaderboard(),
  ]);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="split-header">
          <div>
            <div className="eyebrow">Admin Dashboard | SSR + Cache</div>
            <h1 style={{ fontSize: "3.2rem" }}>Live Tournament Operations</h1>
            <p>
              Registrations render on the server for every request, while the
              leaderboard summary is cached to reduce repeated work.
            </p>
          </div>
          <Link className="pill subtle-link" href="/">
            Back to registration
          </Link>
        </div>
      </section>

      <section className="card-grid section">
        <article className="panel">
          <div className="pill">Live registrations</div>
          <h2>{registrations.length}</h2>
          <p className="small">This list uses SSR with no-store behavior for fresh admin data.</p>
        </article>
        <article className="panel">
          <div className="pill">Cached leaderboard</div>
          <h2>{leaderboard.length}</h2>
          <p className="small">Counts refresh via tag revalidation after successful saves.</p>
        </article>
        <article className="panel">
          <div className="pill">Operational note</div>
          <h2>Server-first</h2>
          <p className="small">Admins receive current data without managing local synchronization logic.</p>
        </article>
      </section>

      <section className="layout-grid section">
        <article className="panel">
          <div className="pill">Recent registrations</div>
          <h2>Submitted families</h2>
          <div className="list">
            {registrations.length > 0 ? (
              registrations.map((registration) => (
                <article key={registration.id} className="registration-item">
                  <strong>{registration.playerName}</strong>
                  <div className="meta-row">
                    <span>Parent: {registration.parentName}</span>
                    <span>{registration.email}</span>
                  </div>
                  <div className="meta-row">
                    <span>{TOURNAMENT_LABELS[registration.tournament]}</span>
                    <span>{formatDate(registration.createdAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">No registrations yet. Submit from the home page to see SSR updates.</div>
            )}
          </div>
        </article>

        <aside className="stack">
          <article className="panel soft">
            <div className="pill">Leaderboard</div>
            <div className="list section">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => (
                  <div key={entry.tournament} className="leaderboard-item">
                    <strong>
                      #{index + 1} {TOURNAMENT_LABELS[entry.tournament]}
                    </strong>
                    <span className="small">{entry.count} registered players</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">Cached summary will populate once data exists.</div>
              )}
            </div>
          </article>

          <article className="panel soft">
            <div className="pill">Teaching prompts</div>
            <div className="list section">
              <div className="info-card">
                <strong>What if the UI is slow?</strong>
                <div className="small">Discuss double clicks, drop-off, and support tickets caused by uncertainty.</div>
              </div>
              <div className="info-card">
                <strong>Why optimistic UX matters</strong>
                <div className="small">A fast-feeling flow can increase completions even when backend latency stays the same.</div>
              </div>
              <div className="info-card">
                <strong>Why cache some data?</strong>
                <div className="small">Stable summaries are cheaper to compute and still feel current when revalidated thoughtfully.</div>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
