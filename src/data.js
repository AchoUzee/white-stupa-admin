// =====================================================================
// WHAT THE ADMIN CAN EDIT
// ---------------------------------------------------------------------
// Page text: every text, image and link on every page, listed automatically
// from the website's code (virtual:site-texts, see vite.config.js).
// Data lists, pages, brand, colours and contact fields: site.config.js
// (the only file that is specific to the White Stupa website).
// =====================================================================
import SITE_TEXTS from 'virtual:site-texts'
import { MAIN_PAGES, LISTS, SITE_FIELD_LABELS } from './site.config.js'

export * from './site.config.js'

// file → { items:[{ key, kind, text, label, group }] }
export const TEXT_FILES = Object.fromEntries(SITE_TEXTS.map(f => [f.file, f.items]))
export const TEXT_COUNT = SITE_TEXTS.reduce((n, f) => n + f.items.length, 0)

const human = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase())

export const ALL_PAGES = Object.fromEntries(MAIN_PAGES.map(([id, name, files, path]) => [id, { id, name, files, path }]))

// Every item of a list: the website's own, plus those created in the admin (marked _new in the document).
export function listItems(kind, doc) {
  const L = LISTS[kind]
  const added = Object.entries(doc[kind] || {}).filter(([key, e]) => e?._new && !L.items.some(i => i[L.id] === key))
    .map(([key, e]) => ({ ...e, [L.id]: key }))
  return L.add?.prepend ? [...added.reverse(), ...L.items] : [...L.items, ...added]
}

// Address-safe id from a title: "Hike to Tiger's Nest" → hike-to-tigers-nest (unique within the list).
export function makeId(kind, doc, name) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item'
  const taken = new Set(listItems(kind, doc).map(i => i[LISTS[kind].id]))
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

// Friendlier labels for data fields.
export const FIELD_LABELS = {
  title: 'Title', heading: 'Heading (two lines)', summary: 'Summary', duration: 'Duration', grade: 'Grade', regions: 'Regions',
  image: 'Image', imageAlt: 'Image description', caption: 'Image caption', quote: 'Quote', intro: 'Introduction',
  highlights: 'Highlights', days: 'Day-by-day itinerary', paras: 'Paragraphs', bullets: 'Bullet points', after: 'Paragraphs after bullets',
  overnight: 'Overnight', notes: 'Notes', items: 'Items', body: 'Story content', excerpt: 'Excerpt', readTime: 'Read time',
  lead: 'Lead paragraph (larger)', head: 'Table header', rows: 'Table rows', steps: 'Steps', text: 'Text', type: 'Type',
  label: 'Label', eyebrow: 'Small line above heading', description: 'Description', tagline: 'Tagline', related: 'Related (slugs)',
  p: 'Paragraph', ul: 'Bullet list', h: 'Small heading',
  ...SITE_FIELD_LABELS,
}

// "+ Add …" choices for lists of mixed blocks, by field name.
export const BLOCK_TEMPLATES = {
  blocks: [['paragraph', { p: '' }], ['bullet list', { ul: [''] }], ['small heading', { h: '' }]],
  introBlocks: [['paragraph', { p: '' }], ['bullet list', { ul: [''] }], ['small heading', { h: '' }]],
}
export const fieldLabel = k => FIELD_LABELS[k] || human(String(k))

export const SITE_IMAGES = typeof __SITE_IMAGES__ !== 'undefined' ? __SITE_IMAGES__ : []
