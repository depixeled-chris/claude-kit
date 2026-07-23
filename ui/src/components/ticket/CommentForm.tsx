// The comment box. Author defaults to "chris" (the maintainer's daily view); @mentions are typed
// inline as plain text and the server derives them. On submit it POSTs through the API, then calls
// onPosted so the parent re-fetches — the durable comment then shows in the stream. A write
// rejection surfaces inline (never an alert), matching the guard-surfacing convention.

import { useState, type FormEvent } from 'react';
import { postComment, ApiError } from '../../services/api';

interface Props {
  projectKey: string;
  ticketId: string;
  onPosted: () => void;
}

export function CommentForm({ projectKey, ticketId, onPosted }: Props) {
  const [author, setAuthor] = useState('chris');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !author.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await postComment(projectKey, ticketId, { text: text.trim(), author: author.trim() });
      setText('');
      onPosted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={submit}>
      <div className="comment-form-row">
        <label>
          <span>Author</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className="input author-input" />
        </label>
      </div>
      <textarea
        className="input comment-textarea"
        placeholder="Add a comment… use @handle to mention"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      {error && <div className="inline-error">{error}</div>}
      <div className="comment-form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting || !text.trim()}>
          {submitting ? 'Posting…' : 'Comment'}
        </button>
      </div>
    </form>
  );
}
