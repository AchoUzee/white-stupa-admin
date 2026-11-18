# White Stupa Admin (React)

Admin for the **white-stupa-react** website. Every text, image and link on every page,
plus every tour, trek, festival, itinerary, journal story, team member, the festival calendar, categories and the
contact details, can be edited here and published. New journal stories, team members and journeys can be **added**.

Same stack as the website: React 19 + Vite 6, same fonts, navy palette and logo.

## Folder layout it expects

Either of these works; the admin finds the website by itself:

    white-stupa-website/                  ← the website repo
      admin/                              ← this admin (inside the website)

    OPOLO/
      white-stupa-react/                  ← the website
      white-stupa-admin-react/react-admin ← this admin (next to it)

If the website lives elsewhere, copy `.env.example` to `.env` and set `SITE_DIR`.

Building the admin needs the website's packages installed (it uses the website's build tools):
run `npm install` in the website folder first. For a Netlify site from the website repo use
base directory `admin`, build command `npm install --prefix .. && npm install && npm run build`,
publish directory `admin/dist`, and set `VITE_API_URL` and `VITE_SITE_URL`.

## Run

Run these from **this folder** (`white-stupa-admin-react/react-admin`), not the folder above it:

    npm install
    npm run dev       # admin on http://localhost:5175 (website stays on 5173)
    npm run build     # production files in /dist

Default login (no server connected): **admin / stupa2026** — change it in Settings.

## What you can edit

| Admin section | Covers |
|---|---|
| Pages (Home, About, Our Team, Tours, Bhutan guide, Journal, Contact, Travel policies) | every heading, paragraph, button, image, image description, link and the browser-tab title (incl. the Bhutan guide's "Last updated" date) |
| Menu & footer | menu labels, footer text and links (email, WhatsApp, Instagram, Facebook) |
| Tour page layout / Story page layout | the fixed labels on generated tour and story pages ("Duration", "Day 1"…) |
| Tours & treks | **Duplicate** starts a new journey from an existing one (hidden until ready). Every tour, trek and festival (all pages are generated from this): card, introduction, at-a-glance facts (best time, highest point, trekking days, accommodation), highlights, the full day-by-day itinerary (paragraphs, lists, small headings, day facts), not-included list, festival calendar, guide sections, notes; hide a tour |
| Journal stories | the whole story: title, author, date, card, every paragraph, heading, list, table and quote; hide a story. **+ New story** adds one (shown first on the Journal page) |
| Team members | the people on the Our Team page: name, role, photo, biography; hide someone. **+ New team member** adds one. Each person lists the stories they wrote |
| Festival calendar | every festival, place and date, month by month, with a year-at-a-glance view. **+ Start next year** copies the newest calendar (dates "To be confirmed", hidden until ready). The menu always links to the newest visible calendar |
| Tour / Journal categories | category headings, descriptions, images, taglines |
| Planning notes | the notes shown at the end of every itinerary |
| Contact details | email, phone, WhatsApp, office, licence, Instagram / Facebook / TripAdvisor (used by header, footer, contact page, tour pages, PDFs, WhatsApp button) and the journal introduction line |
| Images, Colours | photo library and the site's colour palette |

Every field starts with what the site shows today, and "Restore original" puts it back.
Only changed fields are published. Items created in the admin are marked **New** and can be deleted;
the website's own items can only be hidden.

**Stories ↔ team.** A story's *Author* is chosen from the team. The story then shows "By …" and a
"Written by" box linking to the person on /our-team, and the Our Team page lists "Stories by …" under them.

## How it works

**Page text.** The website's build (`white-stupa-react/tools/editable-text.cjs`) wraps every
string on the pages in `__t(key, original)`. The admin runs the same plugin to list the fields,
so the keys always match. A key is the file plus a fingerprint of the original text: if a developer
later changes that text in code, the field shows the new text and any old edit to it is dropped.
While `npm run dev` is running, editing a site page refreshes the admin's field list.

**Tours, stories, team, categories, contact.** Defaults come live from the site's `src/data/journeys.js`
(which merges `treks.js`, `specialJourneys.js` and `sourceItineraries.js`), `src/data/journal.js`, `src/data/team.js` and `src/data/site.js`.
An entry marked `"_new": true` is a whole item created in the admin; the site adds it to its list. Edits are merged into that data on the site before the first render.

**Publishing**, picked automatically:

| Mode | When | What "Publish" does |
|---|---|---|
| dev  | `npm run dev`, no API | writes `white-stupa-react/public/content.json` |
| file | built admin, no API  | downloads `content.json` to upload next to the site's `index.html` |
| api  | `VITE_API_URL` set    | `PUT {API}/content` (plus API sign-in and image uploads) |

API endpoints expected are listed at the top of `src/api.js`. On the site, set
`VITE_CONTENT_URL` to read from the API instead of `/content.json`.

### content.json shape

```json
{
  "version": 2,
  "updatedAt": "2026-11-10T12:00:00.000Z",
  "texts":    { "pages/Home.jsx#1x2y3z": "New heading" },
  "journeys": { "laya-trek": { "title": "…", "days": [ … ], "hidden": true } },
  "articles": { "voices-of-the-himalayas": { "author": "pema-yuden" },
                "my-new-story": { "_new": true, "title": "…", "category": "Food", "body": [ … ] } },
  "team":     { "karma-dema": { "photo": "/uploads/karma.jpg" },
                "sonam-choden": { "_new": true, "name": "Sonam Choden", "role": "Guide", "bio": "…" } },
  "tourCategories":    { "cultural": { "description": "…" } },
  "journalCategories": { "Festivals": { "tagline": "…" } },
  "planningInfo": [ { "title": "…", "text": "…" } ],
  "contact":  { "email": "…", "whatsapp": "975…" },
  "journalIntro": "…",
  "colors":   { "--gold": "#5bb8f0" },
  "uploads":  [ { "name": "x.jpg", "src": "…" } ]
}
```

Website side: `white-stupa-react/src/content/siteContent.js` loads this file.

## Where things are
- `src/site.config.js` — **everything specific to White Stupa**: brand, pages, data lists, calendar, contact fields, colours
- `src/data.js`   — generic helpers (page fields from the site build, labels, new-item ids)
- `src/api.js`    — publish / load / sign-in / uploads (API or file)
- `src/App.jsx`   — layout, navigation, draft + publish state
- `src/Views.jsx` — dashboard, page editor, list editor (add / duplicate / delete), festival calendar, images, colours, publish, settings
- `src/Bookings.jsx` — enquiries & bookings, agents and account (with the server)
- `src/Login.jsx` — sign-in screen
- `src/store.js`, `src/styles.css` — content document, browser storage, styling
- `vite.config.js` — links to the website: photos, data, field list, dev publishing

## Using this admin for another website

Only `src/site.config.js` is White Stupa specific. For another site built the same way
(React + Vite, with `tools/editable-text.cjs` and `src/content/siteContent.js` copied from white-stupa-react):

1. Copy this admin folder, and set `SITE_DIR` in `.env` to the other project.
2. In `src/site.config.js`, change `BRAND` (name, logo, login picture), `MAIN_PAGES` (that site's page files),
   `LISTS` (import that site's data lists; add `add: { … }` to allow new items), `CONTACT_FIELDS`, `COLORS`
   and `CALENDAR` (or remove the calendar link in `App.jsx` if the site has none).
3. On that site, apply each list in `siteContent.js` with `applyEdits(LIST, c.<listName>, '<id field>')`.
4. Run the other site's server (or use content.json) and point `VITE_API_URL` at it.

Page texts, images, colours, publishing, backups and history then work with no other changes.
