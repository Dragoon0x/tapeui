/**
 * VerifyDiff: render a verify report as a readable diff.
 *
 * Status badges: unchanged (green), changed (amber), missing (red).
 * For each changed marker, the property-level diff is shown with before → after.
 */

import * as React from 'react';
import type { VerifyReport } from '../types';
import { palette, styles, MONO_FAMILY } from './styles';

interface VerifyDiffProps {
  report: VerifyReport;
  onClose: () => void;
}

export function VerifyDiff({ report, onClose }: VerifyDiffProps): React.ReactElement {
  return (
    <div data-tape-ui="">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Verify results</div>
        <button data-tape-ui="" style={styles.ghostBtn} onClick={onClose}>Close</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
        <Stat label="total" value={report.total} color={palette.textDim} />
        <Stat label="unchanged" value={report.unchanged} color={palette.green} />
        <Stat label="changed" value={report.changed} color={palette.accent} />
        <Stat label="missing" value={report.missing} color={palette.red} />
      </div>

      {report.results.length === 0 && (
        <div style={styles.empty}>No markers in this report.</div>
      )}

      {report.results.map((r) => (
        <div key={r.markerIndex} style={{ ...styles.commentRow, marginBottom: 8 }}>
          <div style={styles.commentMeta}>
            <span>#{r.markerIndex + 1}</span>
            <span>·</span>
            <span style={styles.badge(
              r.status === 'unchanged' ? 'positive' :
              r.status === 'changed' ? 'note' :
              'issue'
            )}>{r.status}</span>
          </div>
          <div style={{ ...styles.selector, marginBottom: r.status === 'changed' ? 8 : 0 }}>
            {r.selector}
          </div>
          {r.status === 'changed' && (
            <div style={{ background: palette.bg, borderRadius: 6, padding: 8, fontFamily: MONO_FAMILY, fontSize: 11 }}>
              {Object.entries(r.diff).map(([prop, { before, after }]) => (
                <div key={prop} style={{ marginBottom: 4 }}>
                  <span style={{ color: palette.textDim }}>{prop}:</span>{' '}
                  <span style={{ color: palette.red, textDecoration: 'line-through' }}>{before || '(empty)'}</span>
                  <span style={{ color: palette.textFaint }}>{' → '}</span>
                  <span style={{ color: palette.green }}>{after || '(empty)'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }): React.ReactElement {
  return (
    <div style={{
      background: palette.bgRow,
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
      padding: '8px 10px',
      textAlign: 'center',
    }}>
      <div style={{ color, fontSize: 18, fontWeight: 700, fontFamily: MONO_FAMILY, lineHeight: 1.2 }}>{value}</div>
      <div style={{ color: palette.textFaint, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}
