// =====================================================================
// Connection to the website
// ---------------------------------------------------------------------
// Two ways to publish, picked automatically:
//  1. API   — set VITE_API_URL in .env. The admin then signs in, loads and
//             saves through your backend (endpoints below).
//  2. File  — no API set. In `npm run dev` the admin writes content.json
//             straight into white-stupa-react/public/. In a built admin it
//             downloads content.json for you to upload to the site.
//
// Expected API endpoints (any backend: Node, PHP, Supabase function…):
//   POST {API}/auth/login   { username, password }  -> { token }
//   GET  {API}/content                               -> content document
//   PUT  {API}/content      (Bearer token) document  -> { ok: true }
//   POST {API}/images       (Bearer token) multipart "file" -> { url }
// The White Stupa backend (white-stupa-react/server) also provides enquiries,
// booking requests, agents and notifications; see apiGet/apiSend below.
// =====================================================================

export const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
export const MODE = API ? 'api' : import.meta.env.DEV ? 'dev' : 'file'

const TOKEN_KEY = 'wsa_token'
export const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }
export const setToken = t => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ } }

async function call(path, opts = {}) {
  const headers = { ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) }
  const res = await fetch(API + path, { ...opts, headers: { ...headers, ...opts.headers } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    if (res.status === 401 && path !== '/auth/login') { setToken(''); window.dispatchEvent(new Event('wsa:signed-out')) }
    throw new Error(body.error || (res.status === 401 ? 'Your session has expired. Sign in again.' : `Server replied ${res.status}`))
  }
  return res.status === 204 ? null : res.json()
}

export async function apiLogin(username, password) {
  const { token, user } = await call('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  setToken(token)
  return user
}

// Signed-in account (role: admin | agent), or null.
export async function apiMe() {
  if (!API || !getToken()) return null
  try { return (await call('/auth/me')).user } catch { return null }
}

// Generic calls for the bookings, team and account screens.
export const apiGet = path => call(path)
export const apiSend = (path, method, body) => call(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
export async function apiDownload(path, name) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + getToken() } })
  if (!res.ok) throw new Error(`Server replied ${res.status}`)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(await res.blob()); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Latest published document, or null if none / unreachable.
export async function fetchPublished() {
  try {
    if (API) return await call('/content')
    // In dev the admin serves the site's public folder, so content.json is same-origin.
    const res = await fetch((import.meta.env.DEV ? '' : SITE_URL) + '/content.json', { cache: 'no-store' })
    return res.ok ? await res.json() : null
  } catch { return null }
}

export async function publish(doc) {
  const body = JSON.stringify(doc, null, 2)
  if (MODE === 'api') { await call('/content', { method: 'PUT', body }); return 'Published to the website' }
  if (MODE === 'dev') {
    const res = await fetch('/__publish', { method: 'POST', body })
    if (!res.ok) throw new Error('Could not write content.json')
    return 'Written to white-stupa-react/public/content.json'
  }
  downloadJson(doc, 'content.json')
  return 'Downloaded content.json — upload it to the website root'
}

// Uploads go to the server when there is one; otherwise kept inline.
export async function uploadImage(file) {
  if (!API) return null
  const fd = new FormData(); fd.append('file', file)
  const { url } = await call('/images', { method: 'POST', body: fd })
  return url
}

// Site paths like /assets/images/x.jpg: served locally in dev, from the live site once built.
export const previewSrc = p => (p && p.startsWith('/') && !import.meta.env.DEV ? SITE_URL + p : p)

export function downloadJson(obj, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }))
  a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
