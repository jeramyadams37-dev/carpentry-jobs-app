// Local notifications — Capacitor Local Notifications, in-app permission.
// Reminders are scheduled when the app opens (the app has no background
// service in v1, so opening the app refreshes the schedule). Web: no-op.
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from './files.js'
import { todayISO, addMonthsISO, warrantyExpiry, invoiceState } from './store.js'

let warned = false

export async function notificationsSupported() {
  if (!isNative()) return false
  try {
    const res = await LocalNotifications.checkPermissions()
    return res.display === 'granted'
  } catch (e) {
    return false
  }
}

export async function requestNotificationPermission() {
  if (!isNative()) return { granted: false, reason: 'Notifications only work in the installed app, not in a browser preview.' }
  try {
    const res = await LocalNotifications.requestPermissions()
    return { granted: res.display === 'granted', reason: res.display === 'granted' ? '' : 'Permission is ' + res.display + '.' }
  } catch (e) {
    return { granted: false, reason: e.message || 'Permission request failed.' }
  }
}

function at(hour, minute, dayOffset) {
  const d = new Date()
  d.setDate(d.getDate() + (dayOffset || 0))
  d.setHours(hour, minute, 0, 0)
  return d
}

function onDateAt(iso, hour, minute) {
  if (!iso) return null
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  if (isNaN(d)) return null
  d.setHours(hour, minute, 0, 0)
  return d
}

// Build the reminder list from the store, then schedule it.
// Returns { scheduled: n } or { scheduled: 0, reason }.
export async function scheduleAllReminders(store) {
  if (!isNative()) return { scheduled: 0, reason: 'web' }
  if (!store.settings?.notificationsEnabled) return { scheduled: 0, reason: 'off' }
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return { scheduled: 0, reason: 'no permission' }
  } catch (e) {
    return { scheduled: 0, reason: 'permission check failed' }
  }
  const today = todayISO()
  const items = []
  let id = 1
  const push = (title, body, when) => {
    if (!when || when < new Date()) return
    items.push({ id: id++, title, body, schedule: { at: when }, sound: null, attachments: null, actionTypeId: '', extra: null })
  }

  for (const j of store.jobs || []) {
    const label = j.title || j.customerName || 'A job'
    // Follow-ups due tomorrow, and overdue ones (remind once, tomorrow 9am).
    for (const f of j.followUps || []) {
      if (f.done || !f.dueDate) continue
      if (f.dueDate === addMonthsISO(today, 0) || f.dueDate > today) {
        const when = onDateAt(f.dueDate, 9, 0)
        push('Follow-up due', `${f.title} — ${label}`, when)
      } else if (f.dueDate < today) {
        push('Overdue follow-up', `${f.title} — ${label}`, at(9, 0, 1))
      }
    }
    // Overdue invoices.
    if (invoiceState(j) === 'overdue') {
      push('Invoice overdue', `${label} — ${j.customerName || ''} owes the balance. Tap to open the job.`, at(9, 0, 1))
    }
    // Warranty expiry: remind 7 days before, and on the day.
    const exp = warrantyExpiry(j)
    if (exp) {
      const d = new Date(exp + 'T12:00:00')
      d.setDate(d.getDate() - 7)
      const warnDate = d.toISOString().slice(0, 10)
      if (warnDate >= today) push('Warranty expiring', `Warranty on ${label} ends ${exp}.`, onDateAt(warnDate, 9, 0))
    }
    // Inspections: day before, 8am.
    for (const ins of j.inspections || []) {
      if (!ins.date) continue
      const d = new Date(ins.date + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      const dayBefore = d.toISOString().slice(0, 10)
      if (dayBefore >= today) push('Inspection tomorrow', `${ins.type || 'Inspection'} — ${label} (${ins.date}).`, onDateAt(dayBefore, 8, 0))
    }
    // Recurring maintenance due.
    const m = j.maintenance || {}
    if (m.nextDueDate && m.nextDueDate >= today) {
      push('Maintenance due', `${m.notes || 'Maintenance'} — ${label}.`, onDateAt(m.nextDueDate, 9, 0))
    }
  }

  // Business paperwork expiring (insurance lines on the Business screen):
  // remind 30 days before and 7 days before, 9am.
  for (const p of store.business?.blueprint || []) {
    for (const item of p.items || []) {
      if (!item.expiryDate) continue
      for (const daysBefore of [30, 7]) {
        const d = new Date(item.expiryDate + 'T12:00:00')
        d.setDate(d.getDate() - daysBefore)
        const warnDate = d.toISOString().slice(0, 10)
        if (warnDate >= today) push('Business paperwork expiring', `${item.label} expires ${item.expiryDate} (${daysBefore} days).`, onDateAt(warnDate, 9, 0))
      }
    }
  }

  try {
    await LocalNotifications.cancel({ notifications: items.map((n) => ({ id: n.id })) }).catch(() => {})
    // Cancel everything previously scheduled by this app first, so stale
    // reminders from old job states do not pile up.
    await LocalNotifications.getPending().then(async (p) => {
      if (p.notifications && p.notifications.length) {
        await LocalNotifications.cancel({ notifications: p.notifications.map((n) => ({ id: n.id })) })
      }
    }).catch(() => {})
    if (items.length === 0) return { scheduled: 0 }
    await LocalNotifications.schedule({ notifications: items })
    return { scheduled: items.length }
  } catch (e) {
    if (!warned) { warned = true }
    return { scheduled: 0, reason: e.message || 'schedule failed' }
  }
}
