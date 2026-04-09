export type Persona = "creator" | "viewer" | "admin";

export type DraftRecord = {
  id: number;
  title: string;
  body: string;
  updatedAt: string;
};

export type CommentRecord = {
  id: number;
  postId: number;
  authorName: string;
  role: Persona;
  body: string;
  createdAt: string;
};

export type PostRecord = {
  id: number;
  title: string;
  body: string;
  authorName: string;
  role: Persona;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  viewerLiked: boolean;
  comments: CommentRecord[];
};

export type PopularPost = {
  id: number;
  title: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  score: number;
};

export type PersonalizedInsight = {
  id: string;
  label: string;
  title: string;
  detail: string;
};

export type DashboardStats = {
  totalPosts: number;
  totalComments: number;
  totalReactions: number;
  activeDraftAgeLabel: string;
};

export type FeedSnapshot = {
  posts: PostRecord[];
  stats: DashboardStats;
  syncedAt: string;
};

export type ActionResult<T> =
  | {
      status: "success";
      message: string;
      data: T;
    }
  | {
      status: "error";
      message: string;
    };

export type PublishInput = {
  title: string;
  body: string;
  authorName: string;
  role: Persona;
};

export type DraftInput = {
  title: string;
  body: string;
};

export type CommentInput = {
  postId: number;
  authorName: string;
  role: Persona;
  body: string;
};

export type ReactionInput = {
  postId: number;
  viewerId: string;
};

export type StressScenario = "post-burst" | "comment-storm" | "like-spam";
