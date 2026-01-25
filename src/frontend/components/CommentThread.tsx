import { useState, useEffect, useCallback } from 'react';
import type { InvoiceComment } from '../types/invoice';

interface Props {
  invoiceId: number;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommentThread({ invoiceId }: Props) {
  const [comments, setComments] = useState<InvoiceComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/comments`);
      if (response.ok) {
        const data = await response.json() as InvoiceComment[];
        setComments(data);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (response.ok) {
        const comment = await response.json() as InvoiceComment;
        setComments((prev) => [...prev, comment]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (comment: InvoiceComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (response.ok) {
        const updated = await response.json() as InvoiceComment;
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? updated : c))
        );
        setEditingId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const deleteComment = async (commentId: number) => {
    setDeletingId(commentId);
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="comments-loading">Loading comments...</div>;
  }

  return (
    <div className="comment-thread">
      <h2>Comments</h2>

      {comments.length === 0 ? (
        <p className="no-comments">No comments yet</p>
      ) : (
        <ul className="comments-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment-item">
              {editingId === comment.id ? (
                <div className="comment-edit">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="comment-edit-textarea"
                    autoFocus
                  />
                  <div className="comment-edit-actions">
                    <button
                      className="comment-save-button"
                      onClick={() => saveEdit(comment.id)}
                      disabled={!editContent.trim()}
                    >
                      Save
                    </button>
                    <button
                      className="comment-cancel-button"
                      onClick={cancelEditing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="comment-content">{comment.content}</div>
                  <div className="comment-meta">
                    <span className="comment-date">
                      {formatDateTime(comment.created_at)}
                      {comment.updated_at !== comment.created_at && ' (edited)'}
                    </span>
                    <div className="comment-actions">
                      <button
                        className="comment-edit-button"
                        onClick={() => startEditing(comment)}
                        title="Edit"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="comment-delete-button"
                        onClick={() => deleteComment(comment.id)}
                        disabled={deletingId === comment.id}
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="comment-input"
          rows={2}
        />
        <button
          type="submit"
          className="comment-submit-button"
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? 'Adding...' : 'Add Comment'}
        </button>
      </form>
    </div>
  );
}
