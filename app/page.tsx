import { PlatformShell } from "@/components/platform-shell";
import {
  getDashboardStats,
  getDraft,
  getLatestPosts,
  getPersonalizedInsights,
  getPopularPosts,
} from "@/lib/content";
import type { Persona } from "@/lib/types";

type SearchParams = Promise<{
  persona?: string;
}>;

function resolvePersona(value?: string): Persona {
  if (value === "creator" || value === "admin" || value === "viewer") {
    return value;
  }

  return "creator";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const activePersona = resolvePersona(params.persona);
  const viewerId = `${activePersona}-demo-viewer`;

  const [draft, posts, popularPosts, personalizedInsights, stats] = await Promise.all([
    getDraft(),
    getLatestPosts(viewerId),
    getPopularPosts(),
    getPersonalizedInsights(activePersona),
    getDashboardStats(),
  ]);

  return (
    <PlatformShell
      activePersona={activePersona}
      initialDraft={draft}
      initialPosts={posts}
      initialStats={stats}
      personalizedInsights={personalizedInsights}
      popularPosts={popularPosts}
    />
  );
}
