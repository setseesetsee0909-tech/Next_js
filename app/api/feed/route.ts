import { NextRequest } from "next/server";
import { getFeedSnapshot } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = request.nextUrl.searchParams.get("viewerId") ?? "demo-viewer";
  const snapshot = await getFeedSnapshot(viewerId);

  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
