/**
 * Editor: post-recording comment editing surface.
 *
 * Each merged comment can be:
 *   - text-edited (re-runs sentiment + intent extraction on save)
 *   - sentiment-overridden (user knows better than the classifier)
 *   - deleted
 *   - reordered (move up/down)
 *   - merged with the previous comment (text concatenated, marker preserved)
 *
 * The editor never writes back to the report directly; it returns the
 * updated comments via onChange so the parent owns state.
 */

import * as React from 'react';
import type { Comment, CritiqueReport, Sentiment } from '../types';
import { reclassifyComment } from '../core/reporter';
import { palette, styles, MONO_FAMILY } from './styles';

interface EditorProps {
  report: CritiqueReport;
  onChange: (comments: Comment[]) => void;
  onClose: () => void;
}

const SENTIMENTS: Sentiment[] = ['issue', 'positive', 'question', 'note'];

export function Editor({ report, onChange, onClose }: EditorProps): React.ReactElement {
  const [comments, setComments] = React.useState<Comment[]>(report.comments);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<string>('');

  // Sync upward whenever local state changes.
  React.useEffect(() => {
    onChange(comments);
  }, [comments, onChange]);

  const update = (id: string, patch: Partial<Comment>): void => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, edited: true } : c)));
  };

  const remove = (id: string): void => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const move = (id: string, dir: -1 | 1): void => {
    setComments((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const mergePrev = (id: string): void => {
    setComments((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx <= 0) return prev;
      const cur = prev[idx];
      const before = prev[idx - 1];
      const mergedText = [before.text, cur.text].filter(Boolean).join(' / ');
      const merged: Comment = reclassifyComment({
        ...before,
        text: mergedText,
      });
      // Keep before's marker if it had one; otherwise use cur's.
      if (!before.marker && cur.marker) merged.marker = cur.marker;
      const next = prev.slice();
      next.splice(idx, 1);
      next[idx - 1] = merged;
      return next;
    });
  };

  const startEdit = (c: Comment): void => {
    setEditingId(c.id);
    setDraft(c.text);
  };

  const saveEdit = (id: string): void => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return reclassifyComment({ ...c, text: draft });
      }),
    );
    setEditingId(null);
    setDraft('');
  };

  return (
    <div data-tape-ui="">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Edit comments ({comments.length})</div>
        <button data-tape-ui="" style={styles.ghostBtn} onClick={onClose}>Done</button>
      </div>

      {comments.length === 0 && (
        <div style={styles.empty}>No comments. Record again to capture some.</div>
      )}

      {comments.map((c, i) => {
        const isEditing = editingId === c.id;
        return (
          <div key={c.id} style={{ ...styles.commentRow, marginBottom: 8 }}>
            <div style={styles.commentMeta}>
              <span>#{i + 1}</span>
              <span>·</span>
              <span style={styles.badge(c.sentiment)}>{c.sentiment}</span>
              {c.intent.attribute && (
                <>
                  <span>·</span>
                  <span style={{ color: palette.textDim }}>{c.intent.attribute}</span>
                </>
              )}
              {c.edited && (
                <>
                  <span>·</span>
                  <span style={{ color: palette.accent }}>edited</span>
                </>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button data-tape-ui="" style={styles.iconBtn} onClick={() => move(c.id, -1)} title="Move up">↑</button>
                <button data-tape-ui="" style={styles.iconBtn} onClick={() => move(c.id, 1)} title="Move down">↓</button>
                {i > 0 && (
                  <button data-tape-ui="" style={styles.iconBtn} onClick={() => mergePrev(c.id)} title="Merge into previous">⤴</button>
                )}
                <button data-tape-ui="" style={styles.dangerBtn} onClick={() => remove(c.id)} title="Delete">×</button>
              </div>
            </div>

            {c.marker && (
              <div style={{ ...styles.selector, marginBottom: 6 }}>
                {c.marker.selector}
                {c.marker.source?.componentName && (
                  <span style={{ color: palette.textFaint }}>
                    {' '}← {c.marker.source.componentName}
                  </span>
                )}
              </div>
            )}

            {isEditing ? (
              <div>
                <textarea
                  data-tape-ui=""
                  style={styles.textarea}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button data-tape-ui="" style={styles.primaryBtn} onClick={() => saveEdit(c.id)}>Save</button>
                  <button data-tape-ui="" style={styles.ghostBtn} onClick={() => { setEditingId(null); setDraft(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div
                style={{ cursor: 'text', color: c.text ? palette.text : palette.textFaint, fontFamily: MONO_FAMILY, fontSize: 12 }}
                onClick={() => startEdit(c)}
                title="Click to edit"
              >
                {c.text || '(silent click — click to add text)'}
              </div>
            )}

            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SENTIMENTS.map((s) => (
                <button
                  key={s}
                  data-tape-ui=""
                  style={{
                    ...styles.iconBtn,
                    background: c.sentiment === s ? palette.bgRowHover : palette.bgRow,
                    color: c.sentiment === s ? palette.text : palette.textFaint,
                    fontSize: 10,
                    padding: '3px 6px',
                  }}
                  onClick={() => update(c.id, { sentiment: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
