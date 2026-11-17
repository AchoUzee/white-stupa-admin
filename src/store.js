import { useState, useEffect } from 'react'

// ---------- browser storage (drafts, local sign-in) ----------
const mem = {}
export const load = (k, d) => { try { const v = localStorage.getItem('wsa_' + k); return v ? JSON.parse(v) : d } catch { return k in mem ? mem[k] : d } }
export const save = (k, v) => { try { localStorage.setItem('wsa_' + k, JSON.stringify(v)) } catch { mem[k] = v } }
// useState that also saves to the browser
export function usePersist(k, d) {
  const [v, s] = useState(() => load(k, d))
  useEffect(() => save(k, v), [k, v])
  return [v, s]
}
import { previewSrc } from './api.js'
export const bg = src => (src ? { backgroundImage: `url("${previewSrc(src)}")` } : {})

// ---------- the content document ----------
// This exact shape is what the website reads from /content.json or the API
// (white-stupa-react/src/content/siteContent.js).
export const emptyDoc = () => ({
  version: 2, updatedAt: null,
  texts: {},              // page text / image / link edits, by key from the site build
  journeys: {}, articles: {}, team: {}, tourCategories: {}, journalCategories: {}, // edits by id;
  // an entry with _new: true is a whole item created in the admin (new story, team member, journey)
  planningInfo: null,     // replaces the shared "planning" notes when set
  contact: {},            // contact detail edits (email, phone, WhatsApp, links…)
  journalIntro: null,     // replaces the journal introduction line when set
  colors: {}, uploads: [],
})

// Older saves (first admin version) used `pages` with hand-made keys; those are dropped.
export function initialDoc() {
  const doc = load('doc', null)
  const base = { ...emptyDoc(), ...(doc || { colors: load('colors', {}), uploads: load('images', []) }) }
  delete base.pages
  return base
}

// The published file leaves out empty overrides so the site falls back to its own content.
export function cleanDoc(doc) {
  const prune = o => Object.fromEntries(Object.entries(o || {})
    .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? prune(v) : v])
    .filter(([, v]) => v !== undefined && v !== null && !(v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)))
  return { ...prune(doc), version: 2, uploads: doc.uploads || [] }
}
