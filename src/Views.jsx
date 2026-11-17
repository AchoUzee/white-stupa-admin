import { useState, useEffect, useMemo } from 'react'
import { ALL_PAGES, MAIN_PAGES, TEXT_FILES, TEXT_COUNT, LISTS, COLORS, SITE_IMAGES, STANDARD_PLANNING_INFO, CONTACT, CONTACT_FIELDS, JOURNAL_INTRO, BLOCK_TEMPLATES, CALENDAR, fieldLabel, listItems, makeId } from './data.js'
import { bg } from './store.js'
import { MODE, API, SITE_URL, uploadImage, downloadJson } from './api.js'

export const Head = ({ title, onMenu, children }) => (
  <div className="top">
    <button className="btn menu" onClick={onMenu} aria-label="Menu">☰</button>
    <h1>{title}</h1>{children}
  </div>
)

const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const isImagePath = s => typeof s === 'string' && (/^data:image\//.test(s) || (/^(\/|https?:)/.test(s) && /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(s)))

// Uploads go to the API when one is connected, otherwise they are stored inline (keep them small).
async function readFile(f, toast, cb) {
  if (!f) return
  try {
    const url = await uploadImage(f)
    if (url) return cb({ name: f.name, src: url })
  } catch (e) { return toast(e.message || 'Upload failed') }
  if (f.size > 1.5 * 1024 * 1024) return toast('Image is over 1.5 MB. Resize it, or add it to white-stupa-react/public/assets/images.')
  const r = new FileReader()
  r.onload = () => cb({ name: f.name, src: r.result })
  r.readAsDataURL(f)
}

function useDraft(onDirty) {
  const [draft, setDraftState] = useState({})
  const setDraft = d => { setDraftState(d); onDirty(Object.keys(d).length > 0) }
  return [draft, setDraft]
}

function SaveBar({ n, onSave, onDiscard }) {
  return (<>
    <span className="state">{n ? `${n} unsaved change${n > 1 ? 's' : ''}` : ''}</span>
    {n > 0 && <button className="btn" onClick={onDiscard}>Discard</button>}
    <button className="btn pri" disabled={!n} onClick={onSave}>Save changes</button>
    <SaveShortcut enabled={n > 0} onSave={onSave} />
  </>)
}

export function SaveShortcut({ enabled, onSave }) {
  useEffect(() => {
    const h = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (enabled) onSave() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  return null
}

// One image field with preview.
function ImageField({ value, onChange, onPick }) {
  return (
    <div className="imgf">
      <div className="th" style={bg(value)} />
      <div>
        <button type="button" className="btn" onClick={() => onPick(onChange)}>Choose image</button>
        <div className="hint path">{value ? (value.startsWith('data:') ? 'Uploaded image' : value) : 'No image'}</div>
      </div>
    </div>
  )
}

function TextInput({ id, value, onChange, long }) {
  return long || (value && (value.length > 90 || value.includes('\n')))
    ? <textarea id={id} value={value} rows={Math.min(10, Math.max(2, Math.ceil(value.length / 90)))} onChange={e => onChange(e.target.value)} />
    : <input id={id} value={value} onChange={e => onChange(e.target.value)} />
}

// ---------- Dashboard ----------
export function Dashboard({ doc, go, onMenu, unpublished, publishedAt }) {
  const n = o => Object.keys(o || {}).length
  const edited = files => files.reduce((c, f) => c + (TEXT_FILES[f] || []).filter(i => i.key in doc.texts).length, 0)
  return (<>
    <Head title="Welcome back" onMenu={onMenu} />
    <div className="stats">
      <div className="stat"><b>{n(doc.texts)}</b>of {TEXT_COUNT.toLocaleString()} page texts edited</div>
      <div className="stat"><b>{n(doc.journeys)}</b>tours edited</div>
      <div className="stat"><b>{n(doc.articles)}</b>stories edited or added</div>
      <div className="stat"><b>{listItems('team', doc).length}</b>team members</div>
      <div className="stat"><b>{doc.uploads.length}</b>uploaded images</div>
    </div>
    <div className="tip">
      {unpublished ? <>You have saved changes that are <b>not on the website yet</b>. Open <a href="#" onClick={e => { e.preventDefault(); go('publish') }}>Publish</a> when ready.</>
        : <>Everything is published. Last publish: <b>{when(publishedAt)}</b>.</>}
    </div>
    <h3 className="sub">Pages</h3>
    <div className="cards">
      {MAIN_PAGES.map(([id, name, files]) => (
        <button key={id} className="pcard" onClick={() => go('pg:' + id)}><b>{name}</b><span>{files.reduce((c, f) => c + (TEXT_FILES[f]?.length || 0), 0)} fields · {edited(files)} edited</span></button>
      ))}
    </div>
    <h3 className="sub">Add something new</h3>
    <div className="cards">
      <button className="pcard" onClick={() => go('list:articles')}><b>+ New journal story</b><span>Write a story and choose its author</span></button>
      <button className="pcard" onClick={() => go('list:team')}><b>+ New team member</b><span>Shown on the Our Team page</span></button>
      <button className="pcard" onClick={() => go('calendar')}><b>Festival calendar</b><span>Edit dates or start next year</span></button>
    </div>
    <h3 className="sub">Tours, stories, team & categories</h3>
    <div className="cards">
      {Object.entries(LISTS).map(([k, l]) => {
        const added = Object.values(doc[k] || {}).filter(e => e?._new).length
        return <button key={k} className="pcard" onClick={() => go('list:' + k)}><b>{l.title}</b><span>{l.items.length + added} items · {n(doc[k]) - added} edited{added ? ` · ${added} new` : ''}</span></button>
      })}
      <button className="pcard" onClick={() => go('planning')}><b>Planning notes</b><span>Shared by every itinerary</span></button>
      <button className="pcard" onClick={() => go('details')}><b>Contact details</b><span>Email, phone, WhatsApp, licence, social links · {n(doc.contact)} edited</span></button>
    </div>
  </>)
}

// ---------- Image picker (modal) ----------
export function ImagePicker({ uploads, addImage, onPick, onClose, toast }) {
  const [q, setQ] = useState(''), [url, setUrl] = useState('')
  const all = [...uploads.map(i => ({ ...i, up: true })), ...SITE_IMAGES]
  const list = all.filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="box wide">
        <h2>Choose an image</h2>
        <div className="row">
          <input placeholder="Search photos…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search photos" autoFocus />
          <label className="btn">Upload new
            <input type="file" accept="image/*" hidden onChange={e => readFile(e.target.files[0], toast, im => { addImage(im); onPick(im.src) })} />
          </label>
        </div>
        {list.length ? (
          <div className="gal">
            {list.map(im => (
              <button key={im.src} className="gi pick" onClick={() => onPick(im.src)}>
                <div className="th" style={bg(im.src)} /><div>{im.up && <em className="tag">Upload</em>}{im.name}</div>
              </button>
            ))}
          </div>
        ) : <p className="hint">No images match.</p>}
        <div className="row">
          <input placeholder="…or paste an image URL" value={url} onChange={e => setUrl(e.target.value)} aria-label="Image URL" />
          <button className="btn" disabled={!url.trim()} onClick={() => onPick(url.trim())}>Use URL</button>
        </div>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// Shared picker state: pick(cb) opens the modal and calls cb with the chosen src.
function usePicker(doc, addImage, toast) {
  const [cb, setCb] = useState(null)
  const pick = fn => setCb(() => fn)
  const modal = cb && <ImagePicker uploads={doc.uploads} addImage={addImage} toast={toast} onClose={() => setCb(null)} onPick={src => { cb(src); setCb(null) }} />
  return [pick, modal]
}

// Pointers from a page to where its data-driven parts are edited.
const goLink = (go, to, label) => <a href="#" onClick={e => { e.preventDefault(); go(to) }}>{label}</a>
const PAGE_TIPS = {
  'journey-tpl': go => <>These are the labels shared by every tour, trek and festival page. Each journey's own words (itinerary, highlights, inclusions, calendar…) are under {goLink(go, 'list:journeys', 'Tours & treks')}.</>,
  'article-tpl': go => <>These are the labels shared by every story page. The stories themselves are under {goLink(go, 'list:articles', 'Journal stories')}.</>,
  tours: go => <>The tour cards and category sections come from {goLink(go, 'list:journeys', 'Tours & treks')} and {goLink(go, 'list:tourCategories', 'Tour categories')}.</>,
  journal: go => <>The line above the categories is under {goLink(go, 'details', 'Contact details → Journal introduction')}; stories and categories under {goLink(go, 'list:articles', 'Journal stories')} and {goLink(go, 'list:journalCategories', 'Journal categories')}.</>,
  contact: go => <>Email, phone, WhatsApp, licence and social links are edited once under {goLink(go, 'details', 'Contact details')} and update every page.</>,
  chrome: go => <>The tours in the menu come from {goLink(go, 'list:journeys', 'Tours & treks')}; email, phone and social links from {goLink(go, 'details', 'Contact details')}.</>,
  'team-page': go => <>The people on this page are edited under {goLink(go, 'list:team', 'Our Team (website)')}, where you can also add new ones.</>,
  policies: go => <>The contact email on this page is edited under {goLink(go, 'details', 'Contact details')}.</>,
}

// ---------- Page text editor: every text, image and link on a page ----------
export function PageEditor({ pageId, doc, update, addImage, toast, onDirty, onMenu, go }) {
  const page = ALL_PAGES[pageId]
  const items = useMemo(() => page.files.flatMap(f => (TEXT_FILES[f] || []).map(i => ({ ...i, group: page.files.length > 1 ? `${f.includes('Header') ? 'Menu' : 'Footer'} · ${i.group}` : i.group }))), [page])
  const [draft, setDraft] = useDraft(onDirty)
  const [q, setQ] = useState('')
  const [onlyEdited, setOnlyEdited] = useState(false)
  const [pick, picker] = usePicker(doc, addImage, toast)
  const val = i => (i.key in draft ? draft[i.key] : i.key in doc.texts ? doc.texts[i.key] : i.text)
  const n = Object.keys(draft).length
  const set = (i, v) => setDraft({ ...draft, [i.key]: v })
  const save = () => {
    update(d => {
      const texts = { ...d.texts }
      for (const i of items) if (i.key in draft) {
        const v = draft[i.key]
        if (v === i.text || v.trim() === i.text.trim() || v === '') delete texts[i.key]; else texts[i.key] = v
      }
      return { ...d, texts }
    })
    setDraft({}); toast('Saved — publish to update the website')
  }
  const needle = q.trim().toLowerCase()
  const shown = items.filter(i => (!needle || val(i).toLowerCase().includes(needle) || i.text.toLowerCase().includes(needle) || i.group.toLowerCase().includes(needle))
    && (!onlyEdited || i.key in doc.texts || i.key in draft))
  const groups = []
  for (const i of shown) { const g = groups.find(x => x[0] === i.group); g ? g[1].push(i) : groups.push([i.group, [i]]) }

  return (<>
    <Head title={page.name} onMenu={onMenu}>
      <a className="btn" href={SITE_URL + page.path} target="_blank" rel="noopener noreferrer">View ↗</a>
      <SaveBar n={n} onSave={save} onDiscard={() => setDraft({})} />
    </Head>
    <div className="row filters">
      <input placeholder={`Search ${items.length} fields on this page…`} value={q} onChange={e => setQ(e.target.value)} aria-label="Search this page" />
      <label className="check"><input type="checkbox" checked={onlyEdited} onChange={e => setOnlyEdited(e.target.checked)} /> Edited only</label>
    </div>
    {PAGE_TIPS[pageId] && <div className="tip">{PAGE_TIPS[pageId](go)}</div>}
    {!groups.length && <p className="hint">Nothing matches.</p>}
    {groups.map(([title, list], gi) => (
      <details className="sec" key={title} open={!!needle || onlyEdited || gi === 0}>
        <summary>{title} <span className="count">{list.length} fields{list.some(i => i.key in doc.texts) ? ` · ${list.filter(i => i.key in doc.texts).length} edited` : ''}</span></summary>
        <div>
          {list.map(i => {
            const v = val(i), changed = v !== i.text
            return (
              <div key={i.key} className={'fld' + (i.key in doc.texts ? ' edited' : '')}>
                <label htmlFor={'t_' + i.key}>{i.label}{i.kind === 'link' && ' (address)'} {changed && <button type="button" className="link" onClick={() => set(i, i.text)}>Restore original</button>}</label>
                {i.kind === 'image'
                  ? <ImageField value={v} onChange={nv => set(i, nv)} onPick={pick} />
                  : <TextInput id={'t_' + i.key} value={v} onChange={nv => set(i, nv)} />}
                {changed && i.kind !== 'image' && <div className="hint was">Original: {i.text}</div>}
              </div>
            )
          })}
        </div>
      </details>
    ))}
    {picker}
  </>)
}

// ---------- Generic value editor for data (strings, lists, objects) ----------
function blankOf(v) {
  if (typeof v === 'string') return ''
  if (typeof v === 'number') return 0
  if (typeof v === 'boolean') return false
  if (Array.isArray(v)) return v.length && (typeof v[0] === 'string' || Array.isArray(v[0])) ? [blankOf(v[0])] : []
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'type' ? x : blankOf(x)]))
  return ''
}
const preview = v => {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(preview).filter(Boolean).join(' · ')
  if (v && typeof v === 'object') return preview(v.title || v.text || v.label || Object.values(v).find(x => typeof x === 'string') || '')
  return String(v ?? '')
}

// Name shown on each item of a list: article blocks ({ type: 'p' }), itinerary blocks ({ p }, { ul }, { h }) or a number.
const BLOCK_NAMES = { p: 'Paragraph', ul: 'List', h2: 'Heading', h3: 'Subheading', h: 'Small heading', quote: 'Quote', table: 'Table', flow: 'Route steps' }
function blockLabel(item, i) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return String(i + 1)
  if (typeof item.type === 'string') return BLOCK_NAMES[item.type] || fieldLabel(item.type)
  const keys = Object.keys(item)
  if (keys.length === 1 && BLOCK_NAMES[keys[0]]) return BLOCK_NAMES[keys[0]]
  const t = item.title ? preview(item.title) : item.season || ''
  return String(i + 1) + (t ? ' · ' + t : '')
}

function ValueEditor({ name, value, onChange, pick, templates, depth = 0 }) {
  if (typeof value === 'boolean') return <label className="check"><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} /> {fieldLabel(name)}</label>
  if (typeof value === 'number') return <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} />
  if (typeof value === 'string') {
    if (['image', 'src', 'img', 'photo'].includes(name) || isImagePath(value)) return <ImageField value={value} onChange={onChange} onPick={pick} />
    return <TextInput value={value} onChange={onChange} long={['paras', 'intro', 'text', 'summary', 'excerpt', 'description', 'quote', 'after', 'p', 'closing'].includes(name) && value.length > 40} />
  }
  if (Array.isArray(value)) {
    const move = (i, d) => { const a = [...value]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); onChange(a) }
    const tpls = templates || BLOCK_TEMPLATES[name] || (value.length ? [[null, blankOf(value[value.length - 1])]] : [[null, '']])
    return (
      <div className="arr">
        {value.map((item, i) => (
          <div className="arr-item" key={i}>
            <div className="arr-bar">
              <span>{blockLabel(item, i)}</span>
              <button type="button" className="ib" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="ib" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="ib del" onClick={() => confirm('Remove this item?') && onChange(value.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
            </div>
            <ValueEditor name={name} value={item} depth={depth + 1} pick={pick} onChange={v => onChange(value.map((x, j) => (j === i ? v : x)))} />
          </div>
        ))}
        <div className="row wrap">
          {tpls.map(([label, tpl], k) => (
            <button type="button" key={k} className="btn small" onClick={() => onChange([...value, JSON.parse(JSON.stringify(tpl))])}>+ Add {label || (name ? fieldLabel(name).toLowerCase().replace(/s$/, '') : 'item')}</button>
          ))}
        </div>
      </div>
    )
  }
  if (value && typeof value === 'object') return (
    <div className={'obj' + (depth ? ' nested' : '')}>
      {Object.entries(value).map(([k, v]) => k === 'type' ? null : (
        <div key={k}>
          {typeof v !== 'boolean' && <label>{fieldLabel(k)}</label>}
          <ValueEditor name={k} value={v} depth={depth + 1} pick={pick} onChange={nv => onChange({ ...value, [k]: nv })} />
        </div>
      ))}
    </div>
  )
  return <TextInput value={value == null ? '' : String(value)} onChange={onChange} />
}

// "Add block" choices for a list like an article body: one per block type seen across all items.
function templatesFor(items, key) {
  const seen = new Map()
  for (const it of items) for (const b of Array.isArray(it[key]) ? it[key] : []) {
    if (b && typeof b === 'object' && !Array.isArray(b) && typeof b.type === 'string' && !seen.has(b.type)) seen.set(b.type, blankOf(b))
  }
  const names = { p: 'paragraph', h2: 'heading', h3: 'subheading', ul: 'list', quote: 'quote', table: 'table', flow: 'route steps' }
  return seen.size ? [...seen].map(([t, tpl]) => [names[t] || t, tpl]) : null
}

// ---------- Tours, stories, categories ----------
export function ListEditor({ kind, initial, doc, update, addImage, toast, onDirty, onMenu, go }) {
  const L = LISTS[kind]
  const all = useMemo(() => listItems(kind, doc), [kind, doc])
  const [id, setId] = useState(initial && all.some(x => x[L.id] === initial) ? initial : all[0]?.[L.id])
  const [q, setQ] = useState('')
  const [draft, setDraft] = useDraft(onDirty)
  const [pick, picker] = usePicker(doc, addImage, toast)
  const saved = doc[kind][id] || {}
  const isNew = !!saved._new
  // The website's own version of this item ({} for items created here).
  const original = isNew ? {} : L.items.find(i => i[L.id] === id)
  const item = all.find(i => i[L.id] === id)
  const val = k => (k in draft ? draft[k] : k in saved ? saved[k] : original?.[k])
  const n = Object.keys(draft).length
  const set = (k, v) => setDraft({ ...draft, [k]: v })
  // Fields other items have but this one doesn't (e.g. "notes"), offered as "Add a section".
  const optional = useMemo(() => {
    const m = new Map(Object.entries(L.extra || {}))
    for (const it of L.items) for (const [k, v] of Object.entries(it)) if (!m.has(k) && !L.readOnly.includes(k) && k !== 'hidden') m.set(k, v)
    return m
  }, [L])
  const hiddenKeys = new Set(['hidden', '_new', L.id])
  // Existing items keep their category etc.; new ones can choose it.
  const locked = k => !isNew && L.readOnly.includes(k)
  const fields = item ? [...new Set([...Object.keys(original || {}), ...Object.keys(saved), ...Object.keys(draft), ...Object.keys(L.extra || {})])]
    .filter(k => !hiddenKeys.has(k) && !locked(k)) : []
  const missing = [...optional.keys()].filter(k => !fields.includes(k) && !locked(k))

  const choose = s => {
    if (n && !confirm('Leave without saving your changes?')) return
    setDraft({}); setId(s); window.scrollTo({ top: 0 })
  }
  const save = () => {
    update(d => {
      const next = { ...(d[kind][id] || {}) }
      for (const [k, v] of Object.entries(draft)) {
        if (!isNew && (same(v, original[k]) || (v === false && original[k] === undefined))) delete next[k]; else next[k] = v
      }
      const list = { ...d[kind] }
      if (Object.keys(next).length) list[id] = next; else delete list[id]
      return { ...d, [kind]: list }
    })
    setDraft({}); toast('Saved — publish to update the website')
  }
  const resetItem = () => {
    if (!confirm('Undo all edits to this item and use the original from the website?')) return
    update(d => { const list = { ...d[kind] }; delete list[id]; return { ...d, [kind]: list } }); setDraft({})
  }
  // Items made in the admin can be deleted; the website's own can only be hidden.
  const deleteItem = () => {
    if (!confirm(`Delete “${val(L.name) || id}”? This cannot be undone once published.`)) return
    update(d => { const list = { ...d[kind] }; delete list[id]; return { ...d, [kind]: list } })
    setDraft({}); setId(all.find(i => i[L.id] !== id)?.[L.id]); toast('Deleted — publish to update the website')
  }
  const create = (fields, name) => {
    if (n && !confirm('Leave without saving your changes?')) return
    const newId = makeId(kind, doc, name)
    update(d => ({ ...d, [kind]: { ...d[kind], [newId]: { ...fields, _new: true } } }))
    setDraft({}); setId(newId); setQ(''); window.scrollTo({ top: 0 })
    toast('Created — fill it in, save, then publish')
  }
  const addNew = () => {
    const name = prompt(`${L.add.label}: ${fieldLabel(L.name).toLowerCase()}?`)
    if (name?.trim()) create(L.add.create(name.trim(), doc), name.trim())
  }
  const duplicate = () => {
    const name = prompt('Title of the new journey?', `${val(L.name)} (copy)`)
    if (!name?.trim()) return
    const copy = JSON.parse(JSON.stringify({ ...item, ...draft }))
    delete copy[L.id]; delete copy._new; delete copy.hidden
    // Starts hidden so it is not on the website until it is ready.
    create({ ...copy, [L.name]: name.trim(), hidden: true }, name.trim())
  }
  const href = item && (L.pathKey ? SITE_URL + L.path + (item[L.pathKey] ?? id) : SITE_URL + L.path + (L.path.endsWith('/') ? id : ''))
  const linked = L.linked && listItems(L.linked.list, doc)
    .filter(x => (doc[L.linked.list][x[LISTS[L.linked.list].id]]?.[L.linked.field] ?? x[L.linked.field]) === id)

  const field = k => {
    const choices = L.choices?.[k]?.(doc)
    const v = val(k)
    const changed = !isNew && (k in draft || k in saved) && !same(v, original[k])
    return (
      <div key={id + k} className={'fld' + (k in saved && !isNew ? ' edited' : '')}>
        <label htmlFor={'f_' + k}>{fieldLabel(k)} {changed && <button type="button" className="link" onClick={() => set(k, original[k] === undefined ? blankOf(optional.get(k)) : original[k])}>Restore original</button>}</label>
        {choices
          ? <select id={'f_' + k} value={v ?? ''} onChange={e => set(k, e.target.value)}>
              {choices.some(([c]) => c === (v ?? '')) || <option value={v ?? ''}>{v || '—'}</option>}
              {choices.map(([c, label]) => <option key={c} value={c}>{label}</option>)}
            </select>
          : <ValueEditor name={k} value={v ?? blankOf(optional.get(k))} pick={pick} templates={templatesFor(L.items, k)} onChange={nv => set(k, nv)} />}
      </div>
    )
  }

  return (<>
    <Head title={L.title} onMenu={onMenu}>
      <SaveBar n={n} onSave={save} onDiscard={() => setDraft({})} />
    </Head>
    <div className="tip">{L.tip}</div>
    <div className="split">
      <aside className="list">
        {L.add && <button className="btn pri block" onClick={addNew}>+ {L.add.label}</button>}
        <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
        {L.groups(all).map(([label, list]) => {
          const shown = list.filter(i => String(doc[kind][i[L.id]]?.[L.name] || i[L.name] || '').toLowerCase().includes(q.toLowerCase()))
          return shown.length > 0 && (
            <div key={label}>
              <h4>{label}</h4>
              {shown.map(i => {
                const e = doc[kind][i[L.id]]
                return (
                  <button key={i[L.id]} className={'li' + (i[L.id] === id ? ' on' : '')} onClick={() => choose(i[L.id])}>
                    <span>{e?.[L.name] || i[L.name] || '(untitled)'}</span>
                    {e?.hidden ? <em className="tag">Hidden</em> : e?._new ? <em className="tag new">New</em> : e && <i className="dot" aria-label="edited" />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </aside>
      {item && (
        <section className="sec form">
          <div>
            <div className="row between">
              <b className="slug">{[isNew ? 'New · ' + id : id, ...L.readOnly.filter(k => k !== L.id && !isNew).map(k => item[k])].filter(x => typeof x === 'string').join(' · ')}</b>
              <span className="row">
                {L.duplicate && <button className="btn" onClick={duplicate}>{L.duplicate.label}</button>}
                {isNew ? <button className="btn del" onClick={deleteItem}>Delete</button>
                  : doc[kind][id] && <button className="btn" onClick={resetItem}>Undo all edits</button>}
                <a className="btn" href={href} target="_blank" rel="noopener noreferrer">View ↗</a>
              </span>
            </div>
            {isNew && <div className="tip">Created in the admin. Its address will be <b>{L.path.endsWith('/') ? L.path + id : L.path + id}</b>. {val('hidden') ? 'It is hidden until you untick “Hide from website”.' : 'It appears on the website after you publish.'}</div>}
            {L.id !== 'name' && (
              <label className="check"><input type="checkbox" checked={!!val('hidden')} onChange={e => set('hidden', e.target.checked)} /> Hide from website</label>
            )}
            {fields.map(field)}
            {missing.length > 0 && (
              <div className="row wrap">
                <span className="hint">Add a section:</span>
                {missing.map(k => <button key={k} type="button" className="btn small" onClick={() => set(k, blankOf(optional.get(k)))}>+ {fieldLabel(k)}</button>)}
              </div>
            )}
            {L.linked && (
              <div className="linked">
                <h3>{L.linked.title}</h3>
                {linked.length
                  ? <ul>{linked.map(x => {
                      const xid = x[LISTS[L.linked.list].id]
                      return <li key={xid}><a href="#" onClick={e => { e.preventDefault(); go(`list:${L.linked.list}:${xid}`) }}>{doc[L.linked.list][xid]?.title || x.title}</a></li>
                    })}</ul>
                  : <p className="hint">{L.linked.empty}</p>}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
    {picker}
  </>)
}

// ---------- Festival calendar ----------
// A friendlier editor for the `calendar` field of journeys (CALENDAR in site.config.js):
// one table per month, a year-at-a-glance overview and "Start next year".
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthOf = season => MONTHS.findIndex(m => String(season).toLowerCase().includes(m.toLowerCase()))

export function CalendarEditor({ doc, update, toast, onDirty, onMenu, go }) {
  const C = CALENDAR, L = LISTS[C.list]
  const merged = useMemo(() => listItems(C.list, doc).map(j => ({ ...j, ...(doc[C.list][j[L.id]] || {}) })).filter(j => Array.isArray(j[C.field])), [doc, C, L])
  const yearOf = j => String(j[C.yearField] || C.defaultYear)
  const sorted = [...merged].sort((a, b) => yearOf(b).localeCompare(yearOf(a)))
  const [slug, setSlug] = useState(sorted[0]?.[L.id])
  const cal = merged.find(j => j[L.id] === slug) || sorted[0]
  const [months, setMonthsState] = useState(() => cal ? JSON.parse(JSON.stringify(cal[C.field])) : [])
  const [dirty, setDirtyState] = useState(false)
  const setMonths = m => { setMonthsState(m); setDirtyState(true); onDirty(true) }
  useEffect(() => { if (cal) { setMonthsState(JSON.parse(JSON.stringify(cal[C.field]))); setDirtyState(false); onDirty(false) } }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cal) return (<><Head title="Festival calendar" onMenu={onMenu} /><p className="hint">No journey has a calendar yet.</p></>)
  const id = cal[L.id]
  const original = L.items.find(i => i[L.id] === id)
  const isNew = !!doc[C.list][id]?._new
  const hidden = !!doc[C.list][id]?.hidden

  const choose = s => { if (dirty && !confirm('Leave without saving your changes?')) return; setSlug(s) }
  const save = () => {
    update(d => {
      const next = { ...(d[C.list][id] || {}) }
      if (!isNew && original && same(months, original[C.field])) delete next[C.field]; else next[C.field] = months
      const list = { ...d[C.list] }
      if (Object.keys(next).length) list[id] = next; else delete list[id]
      return { ...d, [C.list]: list }
    })
    setDirtyState(false); onDirty(false); toast('Calendar saved — publish to update the website')
  }
  const setHidden = h => update(d => ({ ...d, [C.list]: { ...d[C.list], [id]: { ...(d[C.list][id] || {}), hidden: h } } }))

  const edit = (mi, fn) => setMonths(months.map((m, i) => (i === mi ? fn(m) : m)))
  const setCell = (mi, ri, ci, v) => edit(mi, m => ({ ...m, items: m.items.map((r, j) => (j === ri ? r.map((c, k) => (k === ci ? v : c)) : r)) }))
  const addRow = mi => edit(mi, m => ({ ...m, items: [...m.items, C.columns.map(() => '')] }))
  const delRow = (mi, ri) => confirm('Remove this festival?') && edit(mi, m => ({ ...m, items: m.items.filter((_, j) => j !== ri) }))
  const moveRow = (mi, ri, dir) => edit(mi, m => { const a = [...m.items]; const [x] = a.splice(ri, 1); a.splice(ri + dir, 0, x); return { ...m, items: a } })
  const addMonth = () => {
    const name = prompt('Name of the new section, e.g. "June ' + yearOf(cal) + '"')
    if (name?.trim()) setMonths([...months, { season: name.trim(), items: [C.columns.map(() => '')] }])
  }
  const delMonth = mi => confirm(`Remove “${months[mi].season}” and all its festivals?`) && setMonths(months.filter((_, i) => i !== mi))
  const moveMonth = (mi, dir) => { const a = [...months]; const [x] = a.splice(mi, 1); a.splice(mi + dir, 0, x); setMonths(a) }

  // Copy the newest calendar to next year: same festivals and places, dates to confirm, hidden until ready.
  const nextYear = () => {
    if (dirty && !confirm('Leave without saving your changes?')) return
    const latest = sorted[0], from = yearOf(latest), to = String(Number(from) + 1)
    const newId = C.newSlug(to)
    if (merged.some(j => j[L.id] === newId)) return toast(`The ${to} calendar already exists`)
    if (!confirm(`Create the ${to} calendar from ${from}? Festivals and places are copied; dates are set to “To be confirmed”. It stays hidden until you show it.`)) return
    const swap = v => (typeof v === 'string' ? v.split(from).join(to) : Array.isArray(v) ? v.map(swap) : v)
    const copy = JSON.parse(JSON.stringify(latest))
    delete copy[L.id]; delete copy._new
    for (const k of ['title', 'heading', 'summary', 'duration', 'intro', 'quote']) if (k in copy) copy[k] = swap(copy[k])
    copy[C.yearField] = to
    copy[C.field] = copy[C.field].map(m => ({ ...m, season: swap(m.season), items: m.items.map(r => [...r.slice(0, -1), 'To be confirmed']) }))
    update(d => ({ ...d, [C.list]: { ...d[C.list], [newId]: { ...copy, _new: true, hidden: true } } }))
    setSlug(newId); toast(`${to} calendar created — fill in the dates, save, then show it`)
  }

  const count = months.reduce((n, m) => n + m.items.length, 0)
  const byMonth = MONTHS.map((name, i) => ({ name, items: months.filter(m => monthOf(m.season) === i).flatMap(m => m.items) }))
  const undated = months.filter(m => monthOf(m.season) < 0)

  return (<>
    <Head title="Festival calendar" onMenu={onMenu}>
      <a className="btn" href={SITE_URL + L.path + id} target="_blank" rel="noopener noreferrer">View ↗</a>
      <span className="state">{dirty ? 'Unsaved changes' : ''}</span>
      {dirty && <button className="btn" onClick={() => { setMonthsState(JSON.parse(JSON.stringify(cal[C.field]))); setDirtyState(false); onDirty(false) }}>Discard</button>}
      <button className="btn pri" disabled={!dirty} onClick={save}>Save changes</button>
      <SaveShortcut enabled={dirty} onSave={save} />
    </Head>
    <div className="tip">Festival dates for each year. The menu and the Bhutan guide always link to the newest calendar that is not hidden. Other details of the page (introduction, image…) are under {goLink(go, `list:${C.list}:${id}`, 'Tours & treks')}.</div>
    <div className="row wrap cal-years">
      {sorted.map(j => (
        <button key={j[L.id]} className={'btn' + (j[L.id] === id ? ' pri' : '')} onClick={() => choose(j[L.id])}>
          {yearOf(j)}{doc[C.list][j[L.id]]?.hidden ? ' (hidden)' : ''}
        </button>
      ))}
      <button className="btn" onClick={nextYear}>+ Start {Number(yearOf(sorted[0])) + 1} calendar</button>
    </div>
    <div className="row between">
      <p className="hint">{cal.title} · {count} festivals in {months.length} sections</p>
      <label className="check"><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} /> Hide this calendar from the website</label>
    </div>

    <h3 className="sub">Year at a glance</h3>
    <div className="cal-grid">
      {byMonth.map(m => (
        <div key={m.name} className={'cal-month' + (m.items.length ? '' : ' empty')}>
          <b>{m.name}</b>
          {m.items.length ? <ul>{m.items.map((r, i) => <li key={i}><span>{r[C.columns.length - 1]}</span>{r[0] || '(unnamed)'}</li>)}</ul> : <span className="hint">No festivals</span>}
        </div>
      ))}
    </div>
    {undated.length > 0 && <p className="hint">Sections without a month in their name ({undated.map(m => m.season).join(', ')}) are not shown in the overview but appear on the website.</p>}

    <h3 className="sub">Edit festivals</h3>
    {months.map((m, mi) => (
      <section className="sec form cal-sec" key={mi}>
        <div>
          <div className="row between">
            <input className="cal-season" aria-label="Section name" value={m.season} onChange={e => edit(mi, x => ({ ...x, season: e.target.value }))} />
            <span className="row">
              <button type="button" className="ib" disabled={mi === 0} onClick={() => moveMonth(mi, -1)} aria-label="Move section up">↑</button>
              <button type="button" className="ib" disabled={mi === months.length - 1} onClick={() => moveMonth(mi, 1)} aria-label="Move section down">↓</button>
              <button type="button" className="ib del" onClick={() => delMonth(mi)} aria-label="Remove section">✕</button>
            </span>
          </div>
          <div className="cal-table">
            <div className="cal-row head">{C.columns.map(c => <span key={c}>{c}</span>)}<span /></div>
            {m.items.map((r, ri) => (
              <div className="cal-row" key={ri}>
                {C.columns.map((c, ci) => <input key={ci} aria-label={c} value={r[ci] ?? ''} onChange={e => setCell(mi, ri, ci, e.target.value)} />)}
                <span className="row">
                  <button type="button" className="ib" disabled={ri === 0} onClick={() => moveRow(mi, ri, -1)} aria-label="Move up">↑</button>
                  <button type="button" className="ib" disabled={ri === m.items.length - 1} onClick={() => moveRow(mi, ri, 1)} aria-label="Move down">↓</button>
                  <button type="button" className="ib del" onClick={() => delRow(mi, ri)} aria-label="Remove festival">✕</button>
                </span>
              </div>
            ))}
          </div>
          <button type="button" className="btn small" onClick={() => addRow(mi)}>+ Add festival</button>
        </div>
      </section>
    ))}
    <button type="button" className="btn" onClick={addMonth}>+ Add month / section</button>
  </>)
}

// ---------- Shared planning notes ----------
export function PlanningEditor({ doc, update, addImage, toast, onMenu }) {
  const [value, setValue] = useState(doc.planningInfo || STANDARD_PLANNING_INFO)
  const [pick, picker] = usePicker(doc, addImage, toast)
  const changed = !same(value, doc.planningInfo || STANDARD_PLANNING_INFO)
  return (<>
    <Head title="Planning notes" onMenu={onMenu}>
      {doc.planningInfo && <button className="btn" onClick={() => { if (confirm('Use the original notes from the website?')) { update(d => ({ ...d, planningInfo: null })); setValue(STANDARD_PLANNING_INFO) } }}>Restore original</button>}
      <button className="btn pri" disabled={!changed} onClick={() => { update(d => ({ ...d, planningInfo: same(value, STANDARD_PLANNING_INFO) ? null : value })); toast('Saved — publish to update the website') }}>Save changes</button>
    </Head>
    <div className="tip">These notes (accommodation, pricing, dates…) appear at the end of every generated itinerary page.</div>
    <section className="sec form"><div><ValueEditor name="notes" value={value} onChange={setValue} pick={pick} /></div></section>
    {picker}
  </>)
}

// ---------- Contact details & journal introduction ----------
export function SiteDetails({ doc, update, toast, onDirty, onMenu }) {
  const [draft, setDraft] = useDraft(onDirty)
  const saved = doc.contact || {}
  const val = k => (k in draft ? draft[k] : k in saved ? saved[k] : CONTACT[k] ?? '')
  const intro = 'journalIntro' in draft ? draft.journalIntro : doc.journalIntro ?? JOURNAL_INTRO
  const n = Object.keys(draft).length
  const set = (k, v) => setDraft({ ...draft, [k]: v })
  const save = () => {
    update(d => {
      const contact = { ...(d.contact || {}) }
      let journalIntro = d.journalIntro ?? null
      for (const [k, v] of Object.entries(draft)) {
        if (k === 'journalIntro') journalIntro = !v.trim() || v.trim() === JOURNAL_INTRO ? null : v.trim()
        else if (v.trim() === (CONTACT[k] ?? '')) delete contact[k]
        else contact[k] = v.trim()
      }
      return { ...d, contact, journalIntro }
    })
    setDraft({}); toast('Saved — publish to update the website')
  }
  return (<>
    <Head title="Contact details" onMenu={onMenu}>
      <SaveBar n={n} onSave={save} onDiscard={() => setDraft({})} />
    </Head>
    <div className="tip">Entered once, used everywhere: header, footer, contact page, every tour page, the PDF itineraries, travel policies and the floating WhatsApp button. Leave a link empty to hide it.</div>
    <section className="sec form"><div>
      {CONTACT_FIELDS.map(([k, label, hint]) => {
        const v = val(k), changed = v !== (CONTACT[k] ?? '')
        return (
          <div key={k} className={'fld' + (k in saved ? ' edited' : '')}>
            <label htmlFor={'c_' + k}>{label} {changed && <button type="button" className="link" onClick={() => set(k, CONTACT[k] ?? '')}>Restore original</button>}</label>
            <input id={'c_' + k} value={v} onChange={e => set(k, e.target.value)} />
            {hint && <div className="hint">{hint}</div>}
            {changed && <div className="hint was">Original: {CONTACT[k] || '(empty)'}</div>}
          </div>
        )
      })}
    </div></section>
    <h3 className="sub">Journal introduction</h3>
    <section className="sec form"><div>
      <div className={'fld' + (doc.journalIntro ? ' edited' : '')}>
        <label htmlFor="c_intro">Line above the journal categories {intro !== JOURNAL_INTRO && <button type="button" className="link" onClick={() => set('journalIntro', JOURNAL_INTRO)}>Restore original</button>}</label>
        <TextInput id="c_intro" value={intro} long onChange={v => set('journalIntro', v)} />
      </div>
    </div></section>
  </>)
}

// ---------- Images ----------
export function Images({ doc, update, addImage, toast, onMenu }) {
  const [q, setQ] = useState('')
  const site = SITE_IMAGES.filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
  const copy = src => navigator.clipboard?.writeText(src).then(() => toast('Path copied'))
  return (<>
    <Head title="Images" onMenu={onMenu}>
      <label className="btn pri">Upload images
        <input type="file" accept="image/*" multiple hidden onChange={e => [...e.target.files].forEach(f => readFile(f, toast, addImage))} />
      </label>
    </Head>
    <h3 className="sub">Your uploads</h3>
    <div className="tip">{API ? 'Uploads are stored on your server.' : 'Without a server, uploads are saved inside content.json (max 1.5 MB each). For large photos, add them to white-stupa-react/public/assets/images instead — they appear below automatically.'}</div>
    {doc.uploads.length ? (
      <div className="gal">
        {doc.uploads.map((im, i) => (
          <div className="gi" key={i}>
            <div className="th" style={bg(im.src)} />
            <div><span>{im.name}</span>
              <button className="btn del" onClick={() => confirm('Delete this image?') && update(d => ({ ...d, uploads: d.uploads.filter((_, j) => j !== i) }))}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    ) : <p className="hint">No uploads yet.</p>}
    <div className="row between sub"><h3>Website photos ({SITE_IMAGES.length})</h3><input className="narrow" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search website photos" /></div>
    <div className="gal">
      {site.map(im => (
        <button className="gi pick" key={im.src} onClick={() => copy(im.src)} title="Copy path">
          <div className="th" style={bg(im.src)} /><div>{im.name}</div>
        </button>
      ))}
    </div>
  </>)
}

// ---------- Colours ----------
export function Colours({ doc, update, toast, onMenu }) {
  const [draft, setDraft] = useState(doc.colors)
  return (<>
    <Head title="Colours" onMenu={onMenu}>
      <button className="btn" onClick={() => { if (confirm('Reset all colours to the website defaults?')) { update(d => ({ ...d, colors: {} })); setDraft({}) } }}>Reset to default</button>
      <button className="btn pri" onClick={() => {
        const clean = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== COLORS.find(c => c[0] === k)?.[2]))
        update(d => ({ ...d, colors: clean })); toast('Colours saved — publish to update the website')
      }}>Save colours</button>
    </Head>
    <div className="tip">These are the CSS variables in the website's styles.css. They apply across every page.</div>
    <div className="cols">
      {COLORS.map(([key, label, def]) => (
        <div className="col" key={key}>
          <input type="color" aria-label={label} value={draft[key] || def} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
          <div><b>{label}</b><div className="hint">{key} · {draft[key] || def}</div></div>
        </div>
      ))}
    </div>
    <div className="swatch" style={Object.fromEntries(COLORS.map(([k, , d]) => ['--s' + k.slice(1), draft[k] || d]))}>
      <h2>Preview <em>heading.</em></h2>
      <p>Body text on the page background, with <span>secondary text</span>.</p>
      <button type="button">Button</button>
    </div>
  </>)
}

// ---------- Publish & backup ----------
export function Publish({ doc, restore, onPublish, busy, unpublished, publishedAt, toast, onMenu }) {
  const load = e => {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try { const j = JSON.parse(r.result); if (confirm('Replace all current content with this file?')) { restore(j); toast('Backup restored') } }
      catch { toast('That file could not be read.') }
    }
    r.readAsText(f); e.target.value = ''
  }
  const how = {
    api: <>Publishing sends your content to <b>{API}</b>. The website loads it from there.</>,
    dev: <>Publishing writes <b>content.json</b> into <b>white-stupa-react/public/</b>. The website picks it up on its next load, and it goes live with the site's next deploy.</>,
    file: <>Publishing downloads <b>content.json</b>. Upload it to the root of the website (next to index.html).</>,
  }[MODE]
  return (<>
    <Head title="Publish & backup" onMenu={onMenu} />
    <div className="box">
      <h2>Publish</h2>
      <p>{how}</p>
      <p className="hint">Last published: {when(publishedAt)}{unpublished ? ' · there are newer changes' : ''}</p>
      <button className="btn pri" disabled={busy} onClick={onPublish}>{busy ? 'Publishing…' : 'Publish to website'}</button>
    </div>
    <div className="box">
      <h2>Backup</h2>
      <p>Keep a copy of everything you have edited, or move it to another computer.</p>
      <button className="btn" onClick={() => downloadJson(doc, `white-stupa-backup-${new Date().toISOString().slice(0, 10)}.json`)}>Download backup</button>
      <label className="btn center">Restore from a backup file<input type="file" accept=".json" hidden onChange={load} /></label>
    </div>
  </>)
}

// ---------- Settings ----------
export function Settings({ creds, setCreds, toast, onMenu }) {
  const [u, setU] = useState(creds.u), [cur, setCur] = useState(''), [nw, setNw] = useState(''), [conf, setConf] = useState(''), [err, setErr] = useState('')
  const change = () => {
    if (cur !== creds.p) return setErr('Current password is wrong.')
    if (nw.length < 6) return setErr('New password needs at least 6 characters.')
    if (nw !== conf) return setErr('The new passwords do not match.')
    setCreds({ u: u.trim() || creds.u, p: nw }); setErr(''); setCur(''); setNw(''); setConf(''); toast('Sign-in updated')
  }
  return (<>
    <Head title="Settings" onMenu={onMenu} />
    <div className="box">
      <h2>Connection</h2>
      <p className="hint">Mode: <b>{{ api: 'Server API', dev: 'Local development', file: 'File download' }[MODE]}</b><br />Website: <b>{SITE_URL}</b>{API && <><br />API: <b>{API}</b></>}</p>
      <p className="hint">Change these in the admin's <code>.env</code> file (see README).</p>
    </div>
    {MODE === 'api' ? (
      <div className="box"><h2>Sign-in details</h2><p className="hint">Accounts and passwords are managed by your server.</p></div>
    ) : (
      <div className="box">
        <h2>Sign-in details</h2>
        <div><label htmlFor="su">Username</label><input id="su" value={u} onChange={e => setU(e.target.value)} /></div>
        <div><label htmlFor="sc1">Current password</label><input id="sc1" type="password" value={cur} onChange={e => setCur(e.target.value)} /></div>
        <div><label htmlFor="sn">New password (6+ characters)</label><input id="sn" type="password" value={nw} onChange={e => setNw(e.target.value)} /></div>
        <div><label htmlFor="sn2">Confirm new password</label><input id="sn2" type="password" value={conf} onChange={e => setConf(e.target.value)} />
          {conf && conf !== nw && <div className="hint err">Passwords do not match.</div>}</div>
        <div className="err">{err}</div>
        <button className="btn pri" onClick={change}>Update sign-in</button>
        <p className="hint">This login protects the interface only. Connect an API (VITE_API_URL) for real server-side sign-in before putting the admin online.</p>
      </div>
    )}
  </>)
}
