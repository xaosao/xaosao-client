import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";
import { MessageCircle, Send, Loader, Users, Reply } from "lucide-react";

interface CommentAuthor {
  id: string;
  firstName: string;
  lastName?: string | null;
  profile?: string | null;
}

interface PostComment {
  id: string;
  content: string;
  userType: string;
  createdAt: string;
  parentId?: string | null;
  customer?: CommentAuthor | null;
  model?: CommentAuthor | null;
  replies?: PostComment[];
}

interface PostCommentsProps {
  comments: PostComment[];
  postId: string;
  actionUrl: string;
  currentUserProfile?: { firstName: string; profile?: string | null } | null;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function getAuthorName(comment: PostComment): string {
  const author = comment.userType === "customer" ? comment.customer : comment.model;
  return author ? `${author.firstName} ${author.lastName || ""}`.trim() : "User";
}

function getAuthorProfile(comment: PostComment): string | null | undefined {
  const author = comment.userType === "customer" ? comment.customer : comment.model;
  return author?.profile;
}

// Count total comments including replies
function getTotalCount(comments: PostComment[]): number {
  return comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
}

export default function PostComments({ comments, postId, actionUrl, currentUserProfile }: PostCommentsProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const [localComments, setLocalComments] = useState<PostComment[]>(comments);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string; replyToId?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const isSending = fetcher.state !== "idle";

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as any;
      if (data.success && data.comment) {
        const newComment = data.comment as PostComment;
        if (newComment.parentId) {
          // It's a reply — add to parent's replies
          setLocalComments((prev) =>
            prev.map((c) => {
              if (c.id === newComment.parentId) {
                const withoutTemp = (c.replies || []).filter((r) => !r.id.startsWith("temp-"));
                return { ...c, replies: [...withoutTemp, newComment] };
              }
              return c;
            })
          );
        } else {
          // Top-level comment — replace temp
          setLocalComments((prev) => {
            const withoutTemp = prev.filter((c) => !c.id.startsWith("temp-"));
            return [...withoutTemp, newComment];
          });
        }
        setReplyingTo(null);
      } else if (data.error) {
        // Remove optimistic comments on error
        setLocalComments((prev) =>
          prev
            .filter((c) => !c.id.startsWith("temp-"))
            .map((c) => ({
              ...c,
              replies: (c.replies || []).filter((r) => !r.id.startsWith("temp-")),
            }))
        );
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSending) return;

    const content = commentText.trim();
    const parentId = replyingTo?.id || undefined;

    // Optimistic add
    const optimistic: PostComment = {
      id: `temp-${Date.now()}`,
      content,
      userType: "customer",
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
      customer: currentUserProfile ? { id: "", firstName: currentUserProfile.firstName, profile: currentUserProfile.profile } : null,
    };

    if (parentId) {
      setLocalComments((prev) =>
        prev.map((c) => c.id === parentId ? { ...c, replies: [...(c.replies || []), optimistic] } : c)
      );
    } else {
      setLocalComments((prev) => [...prev, optimistic]);
    }

    setCommentText("");
    setReplyingTo(null);
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    const formData: Record<string, string> = { content };
    if (parentId) formData.parentId = parentId;
    if (replyingTo?.replyToId) formData.replyToId = replyingTo.replyToId;
    fetcher.submit(formData, { method: "post", action: actionUrl });
  };

  const handleReply = (parentId: string, authorName: string, replyToId?: string) => {
    setReplyingTo({ id: parentId, name: authorName, replyToId: replyToId || parentId });
    inputRef.current?.focus();
  };

  const error = fetcher.state === "idle" && (fetcher.data as any)?.error
    ? t((fetcher.data as any).message, { defaultValue: (fetcher.data as any).message })
    : null;

  // Track which comment threads are expanded
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  // Auto-expand when a new reply is added via replyingTo
  useEffect(() => {
    if (replyingTo) {
      setExpandedReplies((prev) => new Set(prev).add(replyingTo.id));
    }
  }, [replyingTo]);

  return (
    <div className="mt-4">
      {/* Header */}
      <h2 className="text-sm font-bold mb-3 flex items-center gap-1">
        <MessageCircle className="h-4 w-4 text-gray-600" />
        {t("posts.comments", { defaultValue: "Comments" })} ({getTotalCount(localComments)})
      </h2>

      {/* Comments List */}
      {localComments.length > 0 ? (
        <div className="space-y-3 mb-3">
          {localComments.map((comment) => {
            const name = getAuthorName(comment);
            const profile = getAuthorProfile(comment);
            const replies = comment.replies || [];
            const hasReplies = replies.length > 0;
            const isExpanded = expandedReplies.has(comment.id);

            return (
              <div key={comment.id}>
                {/* Parent comment with vertical line column */}
                <div className="flex">
                  {/* Left column: avatar + vertical line */}
                  <div className="flex flex-col items-center mr-2 flex-shrink-0">
                    {profile ? (
                      <img src={profile} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    {/* Vertical line from below avatar — visible when replies exist and expanded */}
                    {hasReplies && isExpanded && (
                      <div className="w-0.5 bg-gray-400/50 flex-1 mt-1" />
                    )}
                  </div>

                  {/* Right column: bubble + actions */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-gray-100 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-gray-900">{name}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-2 mt-1 mb-2">
                      <span className="text-xs text-gray-400">{getTimeAgo(comment.createdAt)}</span>
                      {!comment.id.startsWith("temp-") && (
                        <button
                          onClick={() => handleReply(comment.id, name)}
                          className="text-xs font-semibold text-gray-500 hover:text-rose-500 transition-colors"
                        >
                          {t("posts.reply", { defaultValue: "Reply" })}
                        </button>
                      )}
                    </div>

                    {/* Toggle replies accordion */}
                    {hasReplies && (
                      <button
                        onClick={() => toggleReplies(comment.id)}
                        className="flex items-center gap-1 ml-2 my-2 text-xs font-semibold text-gray-500 hover:text-rose-500 transition-colors"
                      >
                        <div className="w-4 border-t border-gray-300" />
                        {isExpanded
                          ? t("posts.hideReplies", { count: replies.length, defaultValue: `Hide ${replies.length} replies` })
                          : t("posts.viewReplies", { count: replies.length, defaultValue: `View ${replies.length} replies` })
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Replies — straight horizontal branch from parent's vertical line to each avatar */}
                {hasReplies && isExpanded && replies.map((reply, i) => {
                  const rName = getAuthorName(reply);
                  const rProfile = getAuthorProfile(reply);
                  const isLast = i === replies.length - 1;

                  return (
                    <div key={reply.id} className="flex">
                      {/* Left column: vertical line continues + horizontal branch */}
                      <div className="relative flex-shrink-0" style={{ width: 32 }}>
                        {/* Vertical line — full height or half for last item */}
                        <div
                          className="absolute left-[15px] top-0 w-0.5 bg-gray-500/40"
                          style={{ height: isLast ? 14 : "100%" }}
                        />
                        {/* Horizontal branch to avatar */}
                        <div
                          className="absolute bg-gray-500/40"
                          style={{ left: 15, top: 13, width: 17, height: 1 }}
                        />
                      </div>

                      {/* Reply avatar + bubble */}
                      <div className="flex gap-2 flex-1 min-w-0">
                        {rProfile ? (
                          <img src={rProfile} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="bg-gray-100 rounded-xl px-3 py-2">
                            <p className="text-xs font-semibold text-gray-900">{rName}</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{reply.content}</p>
                          </div>
                          <div className="flex items-center gap-3 ml-2 mt-1 mb-1">
                            <span className="text-xs text-gray-400">{getTimeAgo(reply.createdAt)}</span>
                            {!reply.id.startsWith("temp-") && (
                              <button
                                onClick={() => handleReply(comment.id, rName, reply.id)}
                                className="text-xs font-semibold text-gray-500 hover:text-rose-500 transition-colors"
                              >
                                {t("posts.reply", { defaultValue: "Reply" })}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div ref={listEndRef} />
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4 mb-3">
          {t("posts.noComments", { defaultValue: "No comments yet. Be the first to comment!" })}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mb-2 px-1">{error}</p>
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-2 py-2.5 bg-gray-50 rounded-t-lg border-t border-x border-gray-200 text-xs text-gray-500">
          <Reply className="h-3 w-3" />
          {t("posts.replyingTo", { name: replyingTo.name, defaultValue: `Replying to ${replyingTo.name}` })} 222222
          <button onClick={() => setReplyingTo(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
        </div>
      )}

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className={`flex items-center gap-2 border-t pt-3 ${replyingTo ? "border-t-0 pt-2" : ""}`}>
        {currentUserProfile?.profile ? (
          <img src={currentUserProfile.profile} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Users className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={replyingTo
            ? t("posts.writeReply", { defaultValue: "Write a reply..." })
            : t("posts.writeComment", { defaultValue: "Write a comment..." })
          }
          className="flex-1 h-9 px-3 text-sm bg-gray-100 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-rose-300"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!commentText.trim() || isSending}
          className={`p-2 rounded-full transition-colors ${commentText.trim() && !isSending
            ? "text-rose-500 hover:bg-rose-50"
            : "text-gray-300 cursor-not-allowed"
            }`}
        >
          {isSending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
