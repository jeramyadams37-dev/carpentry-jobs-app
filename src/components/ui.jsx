import React, { useState } from 'react'
import { STATUS_LABELS } from '../lib/store.js'

export function StatusPill({ status }) {
  return <span className={`pill ${status}`}>{STATUS_LABELS[status] || status}</span>
}

export function Confirm({ title, body, okLabel, onOk, onCancel }) {
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="row">
          <button className="danger" onClick={onOk}>{okLabel || 'Yes, do it'}</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function Stars({ value, onChange }) {
  return (
    <div className="row" role="radiogroup" aria-label="Stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="small"
          style={{ fontSize: 22, minWidth: 48, background: n <= value ? 'var(--amber-bg)' : 'var(--card)', borderColor: '#f59e0b' }}
          onClick={() => onChange && onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState('')
  function show(m) {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }
  const el = msg ? <div className="kbd-note" style={{ position: 'fixed', bottom: 76, left: 16, right: 16, zIndex: 60 }}>{msg}</div> : null
  return { show, el }
}
