"use server";

import { revalidatePath } from "next/cache";
import {
  runStressScenario,
  simulateCommentFlow,
  simulateDraftSave,
  simulatePublishFlow,
  simulateReaction,
} from "@/lib/content";
import type {
  ActionResult,
  CommentInput,
  DraftInput,
  DraftRecord,
  PostRecord,
  ReactionInput,
  StressScenario,
} from "@/lib/types";

function hasEnoughText(value: string, min: number) {
  return value.trim().length >= min;
}

export async function publishPostAction(
  input: Omit<CommentInput, "postId" | "body"> & { title: string; body: string },
): Promise<ActionResult<PostRecord>> {
  if (!hasEnoughText(input.title, 4) || !hasEnoughText(input.body, 12)) {
    return {
      status: "error",
      message: "Title and content need a little more detail before publish.",
    };
  }

  try {
    const post = await simulatePublishFlow(input);
    revalidatePath("/");

    return {
      status: "success",
      message: "Post published. The feed updated immediately and the server is now the source of truth.",
      data: post,
    };
  } catch {
    return {
      status: "error",
      message: "Publish failed. The optimistic post was rolled back. Add #fail only when you want to demo the rollback path.",
    };
  }
}

export async function saveDraftAction(input: DraftInput): Promise<ActionResult<DraftRecord>> {
  try {
    const draft = await simulateDraftSave(input);
    revalidatePath("/");

    return {
      status: "success",
      message: "Draft saved.",
      data: draft,
    };
  } catch {
    return {
      status: "error",
      message: "Auto-save missed this attempt. Keep typing and it will retry.",
    };
  }
}

export async function createCommentAction(input: CommentInput) {
  if (!hasEnoughText(input.body, 2)) {
    return {
      status: "error",
      message: "Comment is too short.",
    } satisfies ActionResult<never>;
  }

  try {
    const comment = await simulateCommentFlow(input);
    revalidatePath("/");

    return {
      status: "success",
      message: "Comment delivered.",
      data: comment,
    } satisfies ActionResult<typeof comment>;
  } catch {
    return {
      status: "error",
      message: "Comment failed to send. Retry keeps the optimistic message visible without losing the text.",
    } satisfies ActionResult<never>;
  }
}

export async function addReactionAction(input: ReactionInput) {
  try {
    const result = await simulateReaction(input.postId, input.viewerId);
    revalidatePath("/");

    return result.accepted
      ? {
          status: "success" as const,
          message: "Reaction synced.",
          likeCount: result.likeCount,
        }
      : {
          status: "error" as const,
          message: "This viewer already reacted. Spam clicks are ignored to protect consistency.",
          likeCount: result.likeCount,
        };
  } catch {
    return {
      status: "error" as const,
      message: "Reaction sync failed.",
      likeCount: 0,
    };
  }
}

export async function runStressTestAction(scenario: StressScenario) {
  try {
    const detail = await runStressScenario(scenario);
    revalidatePath("/");

    return {
      status: "success" as const,
      message: detail,
    };
  } catch {
    return {
      status: "error" as const,
      message: "Stress simulation did not complete.",
    };
  }
}
