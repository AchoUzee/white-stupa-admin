// =====================================================================
// ENQUIRIES & BOOKINGS, TEAM AND ACCOUNT (needs the White Stupa backend)
// ---------------------------------------------------------------------
// Admins see every enquiry and booking request, assign them to agents and
// manage the team. Agents see the ones assigned to them.
// Every enquiry has one-click WhatsApp / email / call buttons.
// =====================================================================
import { useCallback, useEffect, useState } from 'react'
import { API, apiGet, apiSend, apiDownload } from './api.js'
import { Head } from './Views.jsx'

const STATUSES = [
  ['new', 'New'], ['contacted', 'Contacted'], ['quoted', 'Quoted'],
  ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled'],
]
const STATUS_LABEL = Object.fromEntries(STATUSES)
const KIND_LABEL = { booking: 'Booking request', quote: 'Quote request', question: 'Question' }
const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
const ago = iso => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} d ago`
}

const Badge = ({ status }) => <span className={`badge st-${status}`}>{STATUS_LABEL[status] || status}</span>

function NeedsServer({ onMenu, title }) {
  return (<>
    <Head title={title} onMenu={onMenu} />
    <div className="box"><h2>Connect the server</h2>
      <p className="hint">Enquiries, bookings and the team live on the White Stupa backend. Set <code>VITE_API_URL</code> in the admin’s <code>.env</code> (for example <code>http://localhost:4000/api</code>) and restart the admin.</p>
    </div>
  </>)
}

// ---------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------
export function Enquiries({ me, onMenu, toast, openId, setOpenId }) {
  const [rows, setRows] = useState(null)
  const [stats, setStats] = useState(null)
  const [team, setTeam] = useState([])
  const [filter, setFilter] = useState({ status: 'open', kind: '', agent: '', q: '' })
  const [error, setError] = useState('')
  const isAdmin = me?.role === 'admin'

  const load = useCallback(async () => {
    if (!API) return
    const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString()
    try {
      const [list, s] = await Promise.all([apiGet('/enquiries' + (qs ? '?' + qs : '')), apiGet('/stats')])
      setRows(list); setStats(s); setError('')
    } catch (e) { setError(e.message) }
  }, [filter])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (API) apiGet('/users').then(setTeam).catch(() => {}) }, [])
  // Refresh every 60 s so new website enquiries appear without reloading.
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])

  if (!API) return <NeedsServer onMenu={onMenu} title="Enquiries & bookings" />
  if (openId) return <EnquiryDetail id={openId} me={me} team={team} toast={toast} onBack={() => { setOpenId(null); load() }} onMenu={onMenu} />

  const set = (k, v) => setFilter(f => ({ ...f, [k]: v }))
  return (<>
    <Head title="Enquiries & bookings" onMenu={onMenu}>
      {isAdmin && <button className="btn" onClick={() => apiDownload('/enquiries.csv', 'white-stupa-enquiries.csv').catch(e => toast(e.message))}>Export CSV</button>}
      <button className="btn" onClick={load}>Refresh</button>
    </Head>
    {stats && (
      <div className="stats">
        <button className="stat statbtn" onClick={() => setFilter(f => ({ ...f, status: 'new', kind: '' }))}><b>{stats.byStatus.new}</b>new, waiting for a reply</button>
        <button className="stat statbtn" onClick={() => setFilter(f => ({ ...f, status: 'open', kind: 'booking' }))}><b>{stats.openBookings}</b>open booking requests</button>
        <button className="stat statbtn" onClick={() => setFilter(f => ({ ...f, status: 'quoted', kind: '' }))}><b>{stats.byStatus.quoted}</b>quoted</button>
        <button className="stat statbtn" onClick={() => setFilter(f => ({ ...f, status: 'confirmed', kind: '' }))}><b>{stats.byStatus.confirmed}</b>confirmed</button>
        {isAdmin && <button className="stat statbtn" onClick={() => setFilter(f => ({ ...f, status: 'open', agent: 'none' }))}><b>{stats.unassigned}</b>not assigned</button>}
        <div className="stat"><b>{stats.last30}</b>in the last 30 days</div>
      </div>
    )}
    <div className="row wrap filters">
      <input className="narrow" placeholder="Search name, email, ref, tour…" value={filter.q} onChange={e => set('q', e.target.value)} />
      <select className="narrow" value={filter.status} onChange={e => set('status', e.target.value)} aria-label="Status">
        <option value="open">Open (new, contacted, quoted)</option>
        <option value="">All statuses</option>
        {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select className="narrow" value={filter.kind} onChange={e => set('kind', e.target.value)} aria-label="Type">
        <option value="">Quotes and bookings</option>
        <option value="booking">Booking requests</option>
        <option value="quote">Quote requests</option>
      </select>
      {isAdmin && (
        <select className="narrow" value={filter.agent} onChange={e => set('agent', e.target.value)} aria-label="Agent">
          <option value="">Everyone</option>
          <option value="none">Not assigned</option>
          {team.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
    </div>
    {error && <div className="tip err-tip">{error}</div>}
    {!rows ? <p className="hint">Loading…</p> : !rows.length ? (
      <div className="tip">No enquiries match. New website enquiries and booking requests appear here automatically.</div>
    ) : (
      <div className="enq-list">
        {rows.map(e => (
          <button key={e.id} className={`enq ${e.status === 'new' ? 'is-new' : ''}`} onClick={() => setOpenId(e.id)}>
            <div className="enq-main">
              <span className="enq-top">
                <Badge status={e.status} />
                {e.kind === 'booking' && <span className="badge kind-booking">Booking</span>}
                <span className="enq-ref">{e.ref}</span>
              </span>
              <b>{e.name}</b>
              <span className="enq-sub">{e.journey_title || 'Tailor-made / not chosen'}{e.travellers ? ` · ${e.travellers} traveller${e.travellers > 1 ? 's' : ''}` : ''}{e.travel_dates ? ` · ${e.travel_dates}` : ''}</span>
            </div>
            <div className="enq-side">
              <span>{ago(e.created_at)}</span>
              <span className="hint">{e.agent_name || 'Not assigned'}</span>
            </div>
          </button>
        ))}
      </div>
    )}
  </>)
}

// ---------------------------------------------------------------------
// One enquiry
// ---------------------------------------------------------------------
function EnquiryDetail({ id, me, team, toast, onBack, onMenu }) {
  const [e, setE] = useState(null)
  const [note, setNote] = useState('')
  const [quote, setQuote] = useState('')
  const [error, setError] = useState('')
  const isAdmin = me?.role === 'admin'

  const load = useCallback(() => apiGet(`/enquiries/${id}`).then(d => { setE(d); setQuote(d.quote_amount || '') }).catch(err => setError(err.message)), [id])
  useEffect(() => { load() }, [load])

  const patch = async body => {
    try { await apiSend(`/enquiries/${id}`, 'PATCH', body); await load(); toast('Saved') } catch (err) { toast(err.message) }
  }
  const logContact = channel => apiSend(`/enquiries/${id}/log`, 'POST', { channel }).then(load).catch(() => {})
  const addNote = async () => {
    if (!note.trim()) return
    try { await apiSend(`/enquiries/${id}/notes`, 'POST', { text: note }); setNote(''); load() } catch (err) { toast(err.message) }
  }
  const remove = async () => {
    if (!confirm(`Delete enquiry ${e.ref} permanently? This cannot be undone.`)) return
    try { await apiSend(`/enquiries/${id}`, 'DELETE'); toast('Deleted'); onBack() } catch (err) { toast(err.message) }
  }

  if (error) return (<><Head title="Enquiry" onMenu={onMenu}><button className="btn" onClick={onBack}>← Back</button></Head><div className="tip err-tip">{error}</div></>)
  if (!e) return <p className="hint" style={{ paddingTop: 30 }}>Loading…</p>

  const fields = [
    ['Journey', e.journey_title || 'Tailor-made / not chosen'], ['Email', e.email], ['Phone / WhatsApp', e.phone], ['Country', e.country],
    ['Travel dates', e.travel_dates], ['Travellers', e.travellers], ['Interests', e.interests], ['Accommodation', e.accommodation],
    ['Budget', e.budget], ['Trekking', e.trekking], ['Special requirements', e.special], ['Received', when(e.created_at)], ['From page', e.source_page],
  ].filter(([, v]) => v)

  return (<>
    <Head title={e.name} onMenu={onMenu}>
      <button className="btn" onClick={onBack}>← All enquiries</button>
    </Head>
    <div className="enq-head">
      <Badge status={e.status} />
      <span className="badge">{KIND_LABEL[e.kind]}</span>
      <span className="enq-ref">{e.ref}</span>
    </div>

    <div className="contact-actions">
      {e.whatsappLink
        ? <a className="btn wa" href={e.whatsappLink} target="_blank" rel="noopener noreferrer" onClick={() => logContact('whatsapp')}>WhatsApp {e.phone}</a>
        : <span className="hint">No phone number given, so WhatsApp is not available.</span>}
      <a className="btn" href={e.emailLink} onClick={() => logContact('email')}>Email {e.email}</a>
      {e.phone && <a className="btn" href={`tel:${e.phone.replace(/[^\d+]/g, '')}`} onClick={() => logContact('phone')}>Call</a>}
    </div>

    <div className="enq-grid">
      <div className="sec"><div>
        <dl className="kv">{fields.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
        {e.message && <><h3 className="sub" style={{ marginTop: 6 }}>Message</h3><p className="msg">{e.message}</p></>}
      </div></div>

      <div className="enq-side-col">
        <div className="sec"><div>
          <label htmlFor="st">Status</label>
          <select id="st" value={e.status} onChange={ev => patch({ status: ev.target.value })}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label htmlFor="ag">Handled by</label>
          {isAdmin ? (
            <select id="ag" value={e.agent_id ?? ''} onChange={ev => patch({ agentId: ev.target.value || null })}>
              <option value="">Not assigned</option>
              {team.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}{u.role === 'admin' ? ' (admin)' : ''}</option>)}
            </select>
          ) : <p>{e.agent_name || 'Not assigned'}</p>}
          <label htmlFor="qa">Quoted price</label>
          <div className="row"><input id="qa" value={quote} placeholder="e.g. USD 4,800 for 2" onChange={ev => setQuote(ev.target.value)} />
            <button className="btn small" disabled={quote === (e.quote_amount || '')} onClick={() => patch({ quoteAmount: quote })}>Save</button></div>
        </div></div>

        <div className="sec"><div>
          <label htmlFor="nt">Add a note</label>
          <textarea id="nt" rows={3} value={note} placeholder="Call summary, itinerary sent, payment received…" onChange={ev => setNote(ev.target.value)} />
          <button className="btn pri" onClick={addNote} disabled={!note.trim()}>Add note</button>
          <ul className="timeline">
            {e.events.map(ev => (
              <li key={ev.id} className={`ev-${ev.type}`}>
                <span>{ev.text}</span>
                <small>{ev.user_name ? `${ev.user_name} · ` : ''}{when(ev.created_at)}</small>
              </li>
            ))}
          </ul>
        </div></div>
        {isAdmin && <button className="btn del" onClick={remove}>Delete enquiry</button>}
      </div>
    </div>
  </>)
}

// ---------------------------------------------------------------------
// Team (admin): agents who receive enquiries
// ---------------------------------------------------------------------
const blankUser = { username: '', name: '', email: '', phone: '', whatsapp: '', role: 'agent', password: '', receivesNew: true }

export function Team({ me, onMenu, toast }) {
  const [users, setUsers] = useState(null)
  const [system, setSystem] = useState(null)
  const [editing, setEditing] = useState(null)
  const [err, setErr] = useState('')
  const load = () => apiGet('/users').then(setUsers).catch(e => setErr(e.message))
  useEffect(() => { if (API) { load(); apiGet('/system').then(setSystem).catch(() => {}) } }, [])
  if (!API) return <NeedsServer onMenu={onMenu} title="Team" />

  const save = async () => {
    setErr('')
    try {
      const { id, confirm: confirmPw, ...body } = editing
      if ((body.password || confirmPw) && body.password !== confirmPw) return setErr('The passwords do not match.')
      if (!body.password) delete body.password
      if (id) await apiSend(`/users/${id}`, 'PATCH', body)
      else await apiSend('/users', 'POST', body)
      setEditing(null); load(); toast(id ? 'Saved' : 'Account created')
    } catch (e) { setErr(e.message) }
  }
  const set = (k, v) => setEditing(u => ({ ...u, [k]: v }))

  return (<>
    <Head title="Team" onMenu={onMenu}>
      <button className="btn pri" onClick={() => { setErr(''); setEditing({ ...blankUser }) }}>+ Add agent</button>
    </Head>
    <div className="tip">
      New website enquiries and booking requests are shared out <b>in turn</b> to active agents who have “Receives new enquiries” on.
      Each agent gets an email{system?.whatsapp ? ' and a WhatsApp alert' : ''} and sees their enquiries when they sign in.
      {system && (<><br />Email alerts: <b>{system.email ? 'on' : 'off (set SMTP in the server .env)'}</b> · WhatsApp alerts: <b>{system.whatsapp ? 'on' : 'off (optional, WhatsApp Business API)'}</b></>)}
    </div>
    {err && !editing && <div className="tip err-tip">{err}</div>}
    {!users ? <p className="hint">Loading…</p> : (
      <div className="team">
        {users.map(u => (
          <div key={u.id} className={`member ${u.active ? '' : 'off'}`}>
            <div>
              <b>{u.name}</b> <span className="tag">{u.role}</span>{!u.active && <span className="tag">inactive</span>}
              <div className="hint">@{u.username}{u.email ? ` · ${u.email}` : ''}{u.whatsapp ? ` · WhatsApp +${u.whatsapp}` : ''}</div>
              <div className="hint">{u.openCount} open · {u.receivesNew ? 'receives new enquiries' : 'not in rotation'}</div>
            </div>
            <div className="row">
              {u.whatsapp && <a className="btn small wa" href={`https://wa.me/${u.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
              <button className="btn small" onClick={() => { setErr(''); setEditing({ ...u, password: '' }) }}>Edit</button>
            </div>
          </div>
        ))}
      </div>
    )}

    {editing && (
      <div className="modal" onClick={ev => ev.target === ev.currentTarget && setEditing(null)}>
        <div className="box wide">
          <h2>{editing.id ? `Edit ${editing.name}` : 'Add a team member'}</h2>
          <div className="two">
            <div><label htmlFor="un">Username (for sign-in)</label><input id="un" value={editing.username} disabled={!!editing.id} onChange={e => set('username', e.target.value)} /></div>
            <div><label htmlFor="nm">Full name</label><input id="nm" value={editing.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label htmlFor="em">Email (receives enquiry alerts)</label><input id="em" type="email" value={editing.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label htmlFor="wa">WhatsApp number</label><input id="wa" value={editing.whatsapp} placeholder="e.g. 97517539334" onChange={e => set('whatsapp', e.target.value)} /></div>
            <div><label htmlFor="ph">Phone</label><input id="ph" value={editing.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label htmlFor="rl">Role</label>
              <select id="rl" value={editing.role} onChange={e => set('role', e.target.value)}>
                <option value="agent">Agent: sees and handles their enquiries</option>
                <option value="admin">Admin: everything, including website content</option>
              </select></div>
            <div><label htmlFor="pw">{editing.id ? 'New password (leave empty to keep)' : 'Password (8+ characters)'}</label><input id="pw" type="password" autoComplete="new-password" value={editing.password} onChange={e => set('password', e.target.value)} /></div>
            <div><label htmlFor="pw2">Confirm password</label><input id="pw2" type="password" autoComplete="new-password" value={editing.confirm || ''} aria-invalid={!!editing.confirm && editing.confirm !== editing.password} onChange={e => set('confirm', e.target.value)} />
              {!!editing.confirm && editing.confirm !== editing.password && <div className="hint err">Passwords do not match.</div>}</div>
          </div>
          <label className="check"><input type="checkbox" checked={!!editing.receivesNew} onChange={e => set('receivesNew', e.target.checked)} /> Receives new enquiries (in turn)</label>
          {editing.id && editing.id !== me?.id && <label className="check"><input type="checkbox" checked={!!editing.active} onChange={e => set('active', e.target.checked)} /> Account active (can sign in)</label>}
          <div className="err">{err}</div>
          <div className="row"><button className="btn pri" onClick={save}>Save</button><button className="btn" onClick={() => setEditing(null)}>Cancel</button></div>
        </div>
      </div>
    )}
  </>)
}

// ---------------------------------------------------------------------
// My account (everyone): password
// ---------------------------------------------------------------------
export function Account({ me, onMenu, toast }) {
  const [cur, setCur] = useState(''), [nw, setNw] = useState(''), [conf, setConf] = useState(''), [err, setErr] = useState('')
  const mismatch = conf.length > 0 && conf !== nw
  const change = async () => {
    setErr('')
    if (nw !== conf) return setErr('The new passwords do not match.')
    if (nw === cur) return setErr('Choose a new password that is different from the current one.')
    try { await apiSend('/auth/password', 'POST', { current: cur, next: nw }); setCur(''); setNw(''); setConf(''); toast('Password changed') }
    catch (e) { setErr(e.message) }
  }
  return (<>
    <Head title="My account" onMenu={onMenu} />
    <div className="box">
      <h2>{me?.name}</h2>
      <p className="hint">Signed in as <b>@{me?.username}</b> · {me?.role === 'admin' ? 'Admin' : 'Agent'}{me?.email ? ` · ${me.email}` : ''}</p>
    </div>
    <div className="box">
      <h2>Change password</h2>
      <div><label htmlFor="ac1">Current password</label><input id="ac1" type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></div>
      <div><label htmlFor="ac2">New password (8+ characters)</label><input id="ac2" type="password" autoComplete="new-password" value={nw} onChange={e => setNw(e.target.value)} /></div>
      <div><label htmlFor="ac3">Confirm new password</label><input id="ac3" type="password" autoComplete="new-password" value={conf} aria-invalid={mismatch} onChange={e => setConf(e.target.value)} />
        {mismatch && <div className="hint err">Passwords do not match.</div>}</div>
      <div className="err">{err}</div>
      <button className="btn pri" onClick={change} disabled={!cur || nw.length < 8 || nw !== conf}>Change password</button>
    </div>
  </>)
}
