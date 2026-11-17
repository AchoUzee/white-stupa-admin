import { useState, useRef, useEffect } from 'react'
import { MAIN_PAGES, LISTS, BRAND } from './data.js'
import { usePersist, load, save, initialDoc, cleanDoc } from './store.js'
import { MODE, API, SITE_URL, getToken, setToken, fetchPublished, publish, apiMe } from './api.js'
import Login from './Login.jsx'
import { Dashboard, PageEditor, ListEditor, CalendarEditor, PlanningEditor, SiteDetails, Images, Colours, Publish, Settings } from './Views.jsx'
import { Enquiries, Team, Account } from './Bookings.jsx'

// Links in notification emails open #enquiry-<id>
const enquiryFromHash = () => { const m = window.location.hash.match(/^#enquiry-(\d+)$/); return m ? Number(m[1]) : null }

export default function App() {
  const [authed, setAuthed] = useState(() => (MODE === 'api' ? !!getToken() : !!load('session', 0)))
  const [creds, setCreds] = usePersist('creds', { u: 'admin', p: 'stupa2026' })
  const [doc, setDocState] = useState(initialDoc)
  const [publishedAt, setPublishedAt] = usePersist('publishedAt', null)
  const [me, setMe] = useState(null) // signed-in account when a server is connected
  const [openEnquiry, setOpenEnquiry] = useState(enquiryFromHash)
  const [view, setView] = useState(() => (enquiryFromHash() ? 'enquiries' : 'dash'))
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const dirty = useRef(false), timer = useRef()

  useEffect(() => save('doc', doc), [doc])

  // With a server: who is signed in (admin or agent); a 401 anywhere signs out.
  useEffect(() => {
    if (!authed || MODE !== 'api') return
    apiMe().then(u => { if (u) { setMe(u); if (u.role === 'agent') setView(v => (v === 'enquiries' || v === 'account' ? v : 'enquiries')) } else setAuthed(false) })
  }, [authed])
  useEffect(() => {
    const out = () => { setAuthed(false); setMe(null) }
    window.addEventListener('wsa:signed-out', out)
    const onHash = () => { const id = enquiryFromHash(); if (id) { setOpenEnquiry(id); setView('enquiries') } }
    window.addEventListener('hashchange', onHash)
    return () => { window.removeEventListener('wsa:signed-out', out); window.removeEventListener('hashchange', onHash) }
  }, [])
  const isAgent = me?.role === 'agent'

  // On sign-in, pick up a newer version published from elsewhere (another computer, the API).
  useEffect(() => {
    if (!authed || (MODE === 'api' && me?.role === 'agent')) return
    fetchPublished().then(remote => {
      if (remote?.updatedAt && (!doc.updatedAt || remote.updatedAt > doc.updatedAt)) {
        setDocState(d => ({ ...d, ...remote })); setPublishedAt(remote.updatedAt)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, me])

  const toast = m => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 2600) }
  // Every edit goes through here so the "unpublished changes" badge stays right.
  const update = fn => setDocState(d => ({ ...fn(d), updatedAt: new Date().toISOString() }))
  const unpublished = !!doc.updatedAt && doc.updatedAt !== publishedAt

  const go = v => {
    if (dirty.current && !confirm('Leave without saving your changes?')) return
    dirty.current = false; if (v === 'enquiries') setOpenEnquiry(null); setView(v); setOpen(false); window.scrollTo({ top: 0 })
  }
  const logout = () => {
    if (dirty.current && !confirm('You have unsaved changes. Sign out anyway?')) return
    save('session', 0); setToken(''); dirty.current = false; setAuthed(false); setMe(null)
  }
  const doPublish = async () => {
    setBusy(true)
    try { toast(await publish(cleanDoc(doc))); setPublishedAt(doc.updatedAt) }
    catch (e) { toast(e.message || 'Publishing failed') }
    finally { setBusy(false) }
  }
  const addImage = im => update(d => ({ ...d, uploads: [...d.uploads, im] }))
  const restore = j => { setDocState({ ...initialDoc(), ...j, updatedAt: new Date().toISOString() }) }
  const onDirty = d => (dirty.current = d)
  const common = { toast, go, onMenu: () => setOpen(o => !o) }

  if (!authed) return <Login creds={creds} onLogin={user => { save('session', 1); if (user) { setMe(user); if (user.role === 'agent') setView('enquiries') } setAuthed(true) }} />

  const link = (id, label, cls = '') => (
    <a href="#" key={id} className={(view === id || view.startsWith(id + ':') ? 'on ' : '') + cls} onClick={e => { e.preventDefault(); go(id) }}>{label}</a>
  )
  const [, listKind, listItem] = view.startsWith('list:') ? view.split(':') : []
  return (<>
    <div id="app" className="on">
      <div className={'backdrop' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
      <nav className={open ? 'open' : ''}>
        <a href="#" className="brand" onClick={e => { e.preventDefault(); go('dash') }}>
          <img src={BRAND.logo} alt={BRAND.name} onError={e => (e.currentTarget.style.display = 'none')} />
          <small>Website admin</small>
        </a>
        {API && (<>
          <h4>Bookings</h4>
          {link('enquiries', 'Enquiries & bookings')}
          {!isAgent && link('team', 'Staff logins & agents')}
        </>)}
        {!isAgent && (<>
        <h4>Pages</h4>
        {MAIN_PAGES.map(([id, name]) => link('pg:' + id, name))}
        <h4>Tours, stories & team</h4>
        {Object.entries(LISTS).map(([k, l]) => link('list:' + k, l.title))}
        {link('calendar', 'Festival calendar')}
        {link('planning', 'Planning notes')}
        <h4>Website</h4>
        {link('details', 'Contact details')}
        {link('images', 'Images')}{link('colors', 'Colours')}
        {link('publish', <>Publish & backup{unpublished && <i className="dot" aria-label="unpublished changes" />}</>)}
        </>)}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">View website ↗</a>
        <div className="sp" />
        {API && link('account', me ? `My account (${me.name})` : 'My account')}
        {!isAgent && link('settings', 'Settings')}
        <a href="#" onClick={e => { e.preventDefault(); logout() }}>Sign out</a>
      </nav>
      <main>
        <div>
          {view === 'enquiries' && <Enquiries me={me} openId={openEnquiry} setOpenId={id => { setOpenEnquiry(id); if (!id && window.location.hash) history.replaceState(null, '', window.location.pathname) }} {...common} />}
          {view === 'team' && !isAgent && <Team me={me} {...common} />}
          {view === 'account' && <Account me={me} {...common} />}
          {!isAgent && unpublished && view !== 'publish' && (
            <div className="pubbar">
              <span>You have changes that are not on the website yet.</span>
              <button className="btn pri" disabled={busy} onClick={doPublish}>{busy ? 'Publishing…' : 'Publish now'}</button>
            </div>
          )}
          {view === 'dash' && !isAgent && <Dashboard doc={doc} unpublished={unpublished} publishedAt={publishedAt} {...common} />}
          {view.startsWith('pg:') && <PageEditor key={view} pageId={view.slice(3)} doc={doc} update={update} addImage={addImage} onDirty={onDirty} {...common} />}
          {listKind && <ListEditor key={view} kind={listKind} initial={listItem} doc={doc} update={update} addImage={addImage} onDirty={onDirty} {...common} />}
          {view === 'calendar' && <CalendarEditor doc={doc} update={update} onDirty={onDirty} {...common} />}
          {view === 'planning' && <PlanningEditor doc={doc} update={update} addImage={addImage} {...common} />}
          {view === 'details' && <SiteDetails doc={doc} update={update} onDirty={onDirty} {...common} />}
          {view === 'images' && <Images doc={doc} update={update} addImage={addImage} {...common} />}
          {view === 'colors' && <Colours doc={doc} update={update} {...common} />}
          {view === 'publish' && <Publish doc={doc} restore={restore} onPublish={doPublish} busy={busy} unpublished={unpublished} publishedAt={publishedAt} {...common} />}
          {view === 'settings' && <Settings creds={creds} setCreds={setCreds} {...common} />}
        </div>
      </main>
    </div>
    <div id="toast" className={msg ? 'on' : ''} role="status">{msg}</div>
  </>)
}
