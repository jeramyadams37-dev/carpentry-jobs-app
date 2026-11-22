// Device file helpers. Capacitor plugins when running as the installed
// app; plain browser fallbacks when running on the web.
// Goal: files must be reachable in Downloads, not trapped inside the app.
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Clipboard } from '@capacitor/clipboard'

function isNative() {
  try {
    return typeof window !== 'undefined' && !!window.Capacitor && window.Capacitor.isNativePlatform()
  } catch (e) {
    return false
  }
}

function b64ToBlob(b64, mime) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime || 'application/octet-stream' })
}

function webDownload(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// Save a file so the user can find it in Downloads.
// Native: write to the shared Documents folder (visible in Files/Downloads),
// then hand the URI to the share sheet as well so the user can move it.
// Returns a short human-readable location string.
export async function saveToDownloads(filename, base64, mime) {
  if (!isNative()) {
    webDownload(filename, b64ToBlob(base64, mime))
    return 'Downloads/' + filename + ' (browser download)'
  }
  try {
    const res = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    })
    return 'Saved to Documents: ' + filename + ' — open Files > Documents, or use Share to move it to Downloads.'
  } catch (e) {
    // Fallback: write to cache and open the share sheet so the user can
    // save it to Downloads / Drive / Files themselves.
    try {
      const res = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      })
      await Share.share({ title: filename, url: res.uri, dialogTitle: 'Save ' + filename })
      return 'Saved via share sheet — pick Downloads or Drive to keep it.'
    } catch (e2) {
      throw new Error('Could not save the file on this device: ' + (e2.message || e2))
    }
  }
}

// Share a file through the Android share sheet (PDF viewer, Drive, email…).
// Also saves a copy to Documents first so it is not trapped in the app.
export async function shareFile(filename, base64, mime, text) {
  if (!isNative()) {
    webDownload(filename, b64ToBlob(base64, mime))
    return 'Downloaded in the browser: ' + filename
  }
  try {
    const res = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({
      title: filename,
      text: text || '',
      url: res.uri,
      dialogTitle: 'Share ' + filename,
    })
    return 'Shared.'
  } catch (e) {
    if (String(e && e.message).includes('cancel') || String(e).includes('Share canceled')) return 'Share cancelled.'
    throw new Error('Share failed: ' + (e.message || e))
  }
}

// Share plain text (ad draft, job summary) through the Android share sheet.
export async function shareText(text, title) {
  if (!isNative()) {
    if (navigator.share) {
      await navigator.share({ title: title || 'Bid to Finish', text })
      return 'Shared.'
    }
    await Clipboard.write({ string: text })
    return 'Copied to clipboard (browser has no share sheet here).'
  }
  try {
    await Share.share({ title: title || 'Bid to Finish', text, dialogTitle: title || 'Share' })
    return 'Shared.'
  } catch (e) {
    if (String(e && e.message).includes('cancel')) return 'Share cancelled.'
    await Clipboard.write({ string: text })
    return 'Share unavailable — copied to clipboard instead.'
  }
}

export async function copyText(text) {
  try {
    await Clipboard.write({ string: text })
    return 'Copied to clipboard.'
  } catch (e) {
    try {
      await navigator.clipboard.writeText(text)
      return 'Copied to clipboard.'
    } catch (e2) {
      return 'Copy failed — select the text and copy it manually.'
    }
  }
}

// Write a base64 file to cache and return its URI (for photo sharing).
export async function cacheFile(filename, base64) {
  const res = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache })
  return res.uri
}

export { isNative }
