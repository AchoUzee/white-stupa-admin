import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// The admin runs against the White Stupa website project (white-stupa-react).
// It reuses the site's images/logos (publicDir), reads the site's journeys and
// journal data (alias @site), and in development can publish content.json
// straight into the site's public folder.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Where the website is: SITE_DIR if set; otherwise the parent folder when this admin sits in the
  // website repo as admin/; otherwise the sibling layout OPOLO/white-stupa-react.
  const siteDir = path.resolve(__dirname, env.SITE_DIR
    || (fs.existsSync(path.join(__dirname, '..', 'src', 'content', 'siteContent.js')) ? '..' : '../../white-stupa-react'))
  const sitePublic = path.join(siteDir, 'public')
  if (!fs.existsSync(path.join(siteDir, 'src'))) {
    throw new Error(`White Stupa website not found at ${siteDir}. Set SITE_DIR in .env`)
  }

  // Every image already on the website, offered in the image picker.
  const imgDir = path.join(sitePublic, 'assets', 'images')
  const siteImages = fs.existsSync(imgDir)
    ? fs.readdirSync(imgDir).filter(f => /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(f)).sort((a, b) => a.localeCompare(b))
        .map(f => ({ name: f, src: '/assets/images/' + f }))
    : []

  // Dev only: POST /__publish writes content.json into the website's public folder.
  const publish = {
    name: 'white-stupa-publish',
    configureServer(server) {
      server.middlewares.use('/__publish', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', c => (body += c))
        req.on('end', () => {
          try {
            JSON.parse(body)
            fs.writeFileSync(path.join(sitePublic, 'content.json'), body)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, path: path.join(sitePublic, 'content.json') }))
          } catch (e) {
            res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: String(e.message || e) }))
          }
        })
      })
    },
  }

  // virtual:site-texts — every editable text/image/link on the site's pages, found by
  // running the site's own build plugin (tools/editable-text.cjs) in collect mode,
  // so field keys always match what the website looks up.
  const requireSite = createRequire(path.join(siteDir, 'package.json'))
  const listTexts = () => {
    const babel = requireSite('@babel/core')
    const pluginPath = path.join(siteDir, 'tools', 'editable-text.cjs')
    delete requireSite.cache[pluginPath]
    const plugin = requireSite(pluginPath)
    const files = []
    const walk = d => fs.readdirSync(d).forEach(f => {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) walk(p); else if (plugin.INCLUDE.test(p)) files.push(p)
    })
    walk(path.join(siteDir, 'src'))
    return files.map(f => babel.transformSync(fs.readFileSync(f, 'utf8'), {
      filename: f, babelrc: false, configFile: false, code: false,
      parserOpts: { plugins: ['jsx'] }, plugins: [[plugin, { root: siteDir, collect: true }]],
    }).metadata.editable).filter(x => x && x.items.length)
  }
  const siteTexts = {
    name: 'site-texts',
    resolveId: id => (id === 'virtual:site-texts' ? '\0site-texts' : null),
    load(id) {
      if (id !== '\0site-texts') return null
      return 'export default ' + JSON.stringify(listTexts())
    },
    // Editing a site page (or the plugin) refreshes the admin's field list.
    configureServer(server) {
      const siteSrc = path.join(siteDir, 'src')
      server.watcher.add([siteSrc, path.join(siteDir, 'tools')])
      server.watcher.on('change', file => {
        if (!/\.(jsx|cjs)$/.test(file) || !path.resolve(file).startsWith(siteDir)) return
        const mod = server.moduleGraph.getModuleById('\0site-texts')
        if (mod) { server.moduleGraph.invalidateModule(mod); server.ws.send({ type: 'full-reload' }) }
      })
    },
  }

  return {
    plugins: [react(), publish, siteTexts],
    publicDir: sitePublic,
    resolve: { alias: { '@site': path.join(siteDir, 'src') } },
    define: { __SITE_IMAGES__: JSON.stringify(siteImages) },
    // Don't copy the site's ~100 MB of photos into the admin build; previews load them from VITE_SITE_URL.
    build: { copyPublicDir: false },
    server: { port: 5175, fs: { allow: [__dirname, siteDir] } },
    preview: { port: 5175 },
  }
})
