import Link from "next/link";
import { RegistrationForm } from "@/components/registration-form";
import { TOURNAMENT_LABELS } from "@/lib/constants";
import { getCachedLeaderboard, getLiveRegistrations } from "@/lib/registrations";

export default async function HomePage() {
  const [registrations, leaderboard] = await Promise.all([
    getLiveRegistrations(),
    getCachedLeaderboard(),
  ]);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">Indra Cyber School | Lesson / Project</div>
        <h1>Tournament Registration System with Optimistic UX</h1>
        <p>
          Students can trace the full flow from form submission to server action
          to database write, while seeing why instant feedback improves trust and
          conversion.
        </p>

        <div className="stats-grid section">
          <article className="stat-card">
            <span className="muted">Live registrations</span>
            <strong>{registrations.length}</strong>
            <div className="small">SSR list reflects every successful save.</div>
          </article>
          <article className="stat-card">
            <span className="muted">Cached leaderboard</span>
            <strong>{leaderboard.reduce((sum, entry) => sum + entry.count, 0)}</strong>
            <div className="small">Derived data is cached for 60 seconds.</div>
          </article>
          <article className="stat-card">
            <span className="muted">UX impact</span>
            <strong>Instant</strong>
            <div className="small">Optimistic cards appear before the DB round trip finishes.</div>
          </article>
        </div>
      </section>

      <section className="layout-grid section">
        <article className="panel">
          <RegistrationForm recentRegistrations={registrations} />
        </article>

        <aside className="stack">
          <article className="panel soft">
            <div className="pill">Task 2 | Flow Map</div>
            <h2>Form -&gt; Server -&gt; DB -&gt; Admin</h2>
            <div className="list">
              <div className="flow-step">
                <strong>1. Parent submits form</strong>
                <span className="small">Client validates basic fields and shows an optimistic card immediately.</span>
              </div>
              <div className="flow-step">
                <strong>2. Server action validates again</strong>
                <span className="small">Server-side validation protects data quality and rejects invalid input safely.</span>
              </div>
              <div className="flow-step">
                <strong>3. SQLite save completes</strong>
                <span className="small">A server-first write persists the registration and revalidates dashboard routes.</span>
              </div>
              <div className="flow-step">
                <strong>4. Admin dashboard renders live data</strong>
                <span className="small">SSR pulls the newest registrations while the leaderboard stays cached.</span>
              </div>
            </div>
          </article>

          <article className="panel soft">
            <div className="pill">Task 4 | Cached Summary</div>
            <div className="list section">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => (
                  <div key={entry.tournament} className="leaderboard-item">
                    <strong>
                      #{index + 1} {TOURNAMENT_LABELS[entry.tournament]}
                    </strong>
                    <span className="small">{entry.count} registrations</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  Cached leaderboard will appear once registrations exist.
                </div>
              )}
            </div>
          </article>

          <article className="panel soft">
            <div className="pill">Task 6 | Business Reflection</div>
            <div className="list section">
              <div className="info-card">
                <strong>Slow UI hurts trust</strong>
                <div className="small">When families click submit and nothing appears, they may retry, abandon, or doubt the system.</div>
              </div>
              <div className="info-card">
                <strong>Optimistic UX lifts conversion</strong>
                <div className="small">Visible progress reduces anxiety, which helps more users finish registration.</div>
              </div>
              <div className="info-card">
                <strong>Server-first improves admin performance</strong>
                <div className="small">SSR keeps dashboard data fresh without shipping heavy client state.</div>
              </div>
            </div>
            <p className="small section">
              Open the admin view at{" "}
              <Link className="subtle-link" href="/dashboard">
                /dashboard
              </Link>
              .
            </p>
          </article>
        </aside>
      </section>
    </main>
  );
}
