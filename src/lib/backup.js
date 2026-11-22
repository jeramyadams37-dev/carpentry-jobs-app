// Automatic daily backup — dated JSON backups to Documents, keep last 7.
// Runs when the app opens (once per day). The dashboard shows the last
// backup time, and Settings can restore the latest auto-backup in one tap.
// Google Drive sync is a documented follow-up, NOT v1.
import { Filesystem, Directory } from '@capacitor/filesystem'
import { isNative } from './files.js'
import { exportJSON, parseImport, todayISO, nowISO } from './store.js'

const BACKUP_DIR = 'carpentry-jobs-backups'
const KEEP = 7

function backupName(dateISO) {
  return `bid-to-finish-backup_${dateISO}.json`
}

function b64Of(text) {
  return btoa(unescape(encodeURIComponent(text)))
}

function textOf(b64) {
  return decodeURIComponent(escape(atob(b64)))
}

export async function autoBackupIfDue(store) {
  if (!isNative()) return { done: false, reason: 'web' }
  const today = todayISO()
  if (store.lastBackupAt && String(store.lastBackupAt).slice(0, 10) === today) {
    return { done: false, reason: 'already backed up today' }
  }
  try {
    await Filesystem.mkdir({ path: BACKUP_DIR, directory: Directory.Documents, recursive: true }).catch(() => {})
    const json = exportJSON(store)
    await Filesystem.writeFile({
      path: `${BACKUP_DIR}/${backupName(today)}`,
      data: b64Of(json),
      directory: Directory.Documents,
      recursive: true,
    })
    await pruneBackups()
    return { done: true, at: nowISO() }
  } catch (e) {
    return { done: false, reason: e.message || 'backup failed' }
  }
}

export async function pruneBackups() {
  try {
    const list = await Filesystem.readdir({ path: BACKUP_DIR, directory: Directory.Documents })
    const files = (list.files || []).map((f) => f.name).filter((n) => n.startsWith('bid-to-finish-backup_') || n.startsWith('carpentry-jobs-backup_')).sort()
    const extra = files.slice(0, Math.max(0, files.length - KEEP))
    for (const name of extra) {
      await Filesystem.deleteFile({ path: `${BACKUP_DIR}/${name}`, directory: Directory.Documents }).catch(() => {})
    }
    return files.slice(-KEEP)
  } catch (e) {
    return []
  }
}

export async function listAutoBackups() {
  try {
    const list = await Filesystem.readdir({ path: BACKUP_DIR, directory: Directory.Documents })
    return (list.files || []).map((f) => f.name).filter((n) => n.startsWith('bid-to-finish-backup_') || n.startsWith('carpentry-jobs-backup_')).sort().reverse()
  } catch (e) {
    return []
  }
}

export async function readLatestBackup() {
  const files = await listAutoBackups()
  if (files.length === 0) throw new Error('No automatic backup found yet.')
  const res = await Filesystem.readFile({ path: `${BACKUP_DIR}/${files[0]}`, directory: Directory.Documents })
  const text = typeof res.data === 'string' ? textOf(res.data) : ''
  const imported = parseImport(text)
  return { file: files[0], imported }
}
