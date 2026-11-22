// One shared document preview: a scrollable paper view of exactly what the
// matching PDF will contain. Read-only — editing happens on the tabs.
// The sheet is paper (white, dark ink) in both themes, like a printed page;
// only the modal chrome follows the app theme.
import React from 'react'

export default function PreviewModal({ doc, shareLabel, onClose, onShare }) {
  if (!doc) return null
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>Preview — {doc.title}</h2>
          <button className="small" onClick={onClose}>✕ Close</button>
        </div>
        <p className="muted">This is exactly what the {shareLabel || 'document'} will contain. Read-only — edit on the tabs, then preview again.</p>
        <div className="doc">
          {doc.stamp && <p className="stamp">{doc.stamp}</p>}
          <p className="brand">{doc.brand}</p>
          {doc.bizLine && <p className="muted">{doc.bizLine}</p>}
          <h2>{doc.title}</h2>
          <hr className="rule" />
          {(doc.kv || []).map(([k, v], i) => (
            <div className="kv" key={i}><b>{k}</b><span>{v}</span></div>
          ))}
          {(doc.sections || []).map((s, i) => (
            <div key={i}>
              {s.heading && <h3>{s.heading}</h3>}
              {s.text && <p>{s.text}</p>}
              {(s.kv || []).map(([k, v], j) => (
                <div className="kv" key={j}><b>{k}</b><span>{v}</span></div>
              ))}
              {(s.lines || []).map((l, j) => <p key={j}>{l}</p>)}
              {s.table && (
                <table>
                  <thead><tr>{s.table.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
                  <tbody>{s.table.rows.map((r, j) => (
                    <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>
                  ))}</tbody>
                </table>
              )}
              {(s.totals || []).map(([k, v], j) => (
                <div className="tot" key={j}><span>{k}</span><span>{v}</span></div>
              ))}
              {s.grand && <div className="tot grand"><span>{s.grand[0]}</span><span>{s.grand[1]}</span></div>}
            </div>
          ))}
          {(doc.sig || []).map((s, i) => <p className="sig" key={i}>{s}</p>)}
        </div>
        <div className="row wrap" style={{ marginTop: 12 }}>
          {onShare && <button className="primary" onClick={onShare}>Share {shareLabel || doc.title}</button>}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
