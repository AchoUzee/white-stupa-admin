import { useState } from 'react'
import { MODE, apiLogin } from './api.js'
import { BRAND } from './data.js'

export default function Login({ creds, onLogin }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setErr('')
    if (MODE === 'api') {
      setBusy(true)
      try { onLogin(await apiLogin(u.trim(), p)) }
      catch (e2) { setErr(/fetch|network/i.test(e2.message) ? 'Cannot reach the server. Is the backend running?' : e2.message || 'Sign-in failed.') }
      finally { setBusy(false) }
    } else if (u.trim() === creds.u && p === creds.p) onLogin()
    else setErr('Wrong username or password.')
  }
  return (
    <section id="login">
      <div className="l-art" style={{ backgroundImage: `linear-gradient(180deg,rgba(6,15,32,.35),rgba(6,15,32,.92)),url("${BRAND.loginImage}")` }}>
        <img className="l-logo" src={BRAND.logo} alt={BRAND.name} onError={e => (e.currentTarget.style.display = 'none')} />
        <h1>{BRAND.loginTitle[0]} <em>{BRAND.loginTitle[1]}</em></h1>
        <p>{BRAND.loginText}</p>
      </div>
      <div className="l-form">
        <form onSubmit={submit}>
          <h2>Admin sign in</h2>
          <div><label htmlFor="u">Username</label><input id="u" autoComplete="username" required value={u} onChange={e => setU(e.target.value)} /></div>
          <div><label htmlFor="p">Password</label><input id="p" type="password" autoComplete="current-password" required value={p} onChange={e => setP(e.target.value)} /></div>
          <div className="err" role="alert">{err}</div>
          <button className="btn pri" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {MODE !== 'api' && <p className="hint">First visit? Use <b>admin</b> and <b>stupa2026</b>, then change the password under Settings.</p>}
        </form>
      </div>
    </section>
  )
}
