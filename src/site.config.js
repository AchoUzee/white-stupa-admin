// =====================================================================
// SITE CONFIGURATION: everything specific to the White Stupa website
// ---------------------------------------------------------------------
// The rest of the admin (editors, publishing, images, colours, bookings)
// is generic. To run this admin for ANOTHER website built the same way
// (React + Vite, tools/editable-text.cjs, src/content/siteContent.js):
//   1. set SITE_DIR in .env to that project's folder;
//   2. copy this file and change the brand, pages, lists and colours to
//      match that site's src/data files (see README → "Another website").
// =====================================================================
import { CATEGORIES, JOURNEYS, STANDARD_PLANNING_INFO } from '@site/data/journeys.js'
import { ARTICLES, JOURNAL_CATEGORIES, JOURNAL_INTRO } from '@site/data/journal.js'
import { CONTACT } from '@site/data/site.js'
import { TEAM } from '@site/data/team.js'

export { CATEGORIES, JOURNEYS, STANDARD_PLANNING_INFO, ARTICLES, JOURNAL_CATEGORIES, JOURNAL_INTRO, CONTACT, TEAM }

// Name and pictures used by the admin itself (paths are in the website's public folder).
export const BRAND = {
  name: 'White Stupa Travels',
  logo: '/assets/logo/white-stupa-horizontal.png',
  loginImage: '/assets/images/buddha.webp',
  loginTitle: ['Care for the White Stupa', 'website.'],
  loginText: 'Update pages, tours, journal stories, the team, the festival calendar, photos and colours in one quiet place, then publish them to the site.',
}

// Main pages, in menu order: [id, name, site files it is made of, address on the site].
export const MAIN_PAGES = [
  ['home', 'Home', ['pages/Home.jsx'], '/'],
  ['about', 'About', ['pages/About.jsx'], '/about'],
  ['team-page', 'Our Team page', ['pages/OurTeam.jsx'], '/our-team'],
  ['tours', 'Tours', ['pages/Tours.jsx'], '/tours'],
  ['bhutan', 'Bhutan guide', ['pages/Bhutan.jsx'], '/bhutan'],
  ['journal', 'Journal', ['pages/Journal.jsx'], '/journal'],
  ['contact', 'Contact', ['pages/Contact.jsx'], '/contact'],
  ['policies', 'Travel policies', ['pages/TravelPolicies.jsx'], '/travel-policies'],
  ['chrome', 'Menu & footer', ['components/Header.jsx', 'components/Footer.jsx'], '/'],
  ['journey-tpl', 'Tour page layout', ['pages/JourneyDetail.jsx'], '/tours/glimpse-of-bhutan'],
  ['article-tpl', 'Story page layout', ['pages/JournalArticle.jsx'], '/journal/understanding-tshechus'],
]

const human = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase())
const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

// Team members for "Written by" pickers: original team plus people added in the admin.
const teamChoices = doc => {
  const added = Object.entries(doc.team || {}).filter(([, e]) => e?._new).map(([id, e]) => ({ id, ...e }))
  return [['', '— No author —'], ...[...TEAM, ...added].map(m => {
    const e = doc.team?.[m.id] || {}
    return [m.id, (e.name || m.name) + ((e.role || m.role) ? ` · ${e.role || m.role}` : '') + (e.hidden ? ' (hidden)' : '')]
  })]
}

// ---------------------------------------------------------------------
// Data lists, editable field by field.
//   items      the website's list (defaults)       id / name: key and title fields
//   path       address on the site ('/tours/' + id, or path + item[pathKey])
//   readOnly   fields shown but not editable on existing items
//   groups     how the list is grouped in the side bar (gets every item, incl. new ones)
//   choices    fields edited with a drop-down: (doc) => [[value, label], …]
//   extra      fields every item may have even if none has them yet
//   add        "+ New" button: { label, prepend?, create(name, doc) → new item }
//   duplicate  "Duplicate" button: copies the open item as a starting point
//   linked     a short list of related items shown under the form
// ---------------------------------------------------------------------
export const LISTS = {
  journeys: {
    title: 'Tours & treks', items: JOURNEYS, id: 'slug', name: 'title', path: '/tours/', readOnly: ['slug', 'category'],
    groups: all => CATEGORIES.map(c => [c.label, all.filter(j => j.category === c.key)]),
    choices: { category: () => CATEGORIES.map(c => [c.key, c.label]) },
    duplicate: { label: 'Duplicate as a new journey' },
    tip: 'Every tour, trek and festival: card details, introduction, at-a-glance facts, highlights, the full day-by-day itinerary, inclusions, festival calendar and notes. Use “Duplicate” to start a new journey from an existing one.',
  },
  articles: {
    title: 'Journal stories', items: ARTICLES, id: 'slug', name: 'title', path: '/journal/', readOnly: ['slug', 'category'],
    groups: all => JOURNAL_CATEGORIES.map(c => [c.name, all.filter(a => a.category === c.name)]),
    choices: { category: () => JOURNAL_CATEGORIES.map(c => [c.name, c.name]), author: teamChoices },
    extra: { author: '', date: '' },
    add: {
      label: 'New story', prepend: true,
      create: title => ({
        title, category: JOURNAL_CATEGORIES[0].name, author: '', date: today(), readTime: '',
        image: '', imageAlt: '', excerpt: '',
        body: [{ type: 'p', lead: true, text: '' }, { type: 'p', text: '' }],
        related: [],
      }),
    },
    tip: 'The full story: title, author, card details and every paragraph, heading, list, table and quote. “+ New story” adds a story to the journal; it appears first on the Journal page.',
  },
  team: {
    title: 'Our Team (website)', items: TEAM, id: 'id', name: 'name', path: '/our-team#', pathKey: 'id', readOnly: ['id'],
    groups: all => [['Team', all]],
    add: { label: 'New team member', create: name => ({ name, role: '', photo: '', bio: '' }) },
    linked: {
      title: 'Journal stories by this person', list: 'articles', field: 'author',
      empty: 'No stories yet. Choose this person as “Author” on a journal story.',
    },
    tip: 'The people on the Our Team page. Each can be chosen as the author of a journal story; the story then shows “Written by” and the team page lists their stories.',
  },
  tourCategories: {
    title: 'Tour categories', items: CATEGORIES, id: 'key', name: 'label', path: '/tours#', pathKey: 'anchor', readOnly: ['key', 'group', 'anchor'],
    groups: all => [['Categories', all]],
    tip: 'The category sections on the Tours page and in the menu.',
  },
  journalCategories: {
    title: 'Journal categories', items: JOURNAL_CATEGORIES, id: 'name', name: 'name', path: '/journal', readOnly: ['name'],
    groups: all => [['Categories', all]],
    tip: 'Tagline and introduction shown when a journal category is selected. Names are fixed because stories are filed under them.',
  },
}

// Festival calendar screen: journeys that have a `calendar` field,
// [{ season: 'February 2027', items: [[festival, place, dates], …] }, …].
export const CALENDAR = {
  list: 'journeys', field: 'calendar', yearField: 'calendarYear', defaultYear: '2026',
  columns: ['Festival', 'Place', 'Dates'],
  newSlug: year => `festival-dates-${year}`,
}

// Contact details (website src/data/site.js), used by the header, footer,
// contact page, every tour page, the PDF itineraries and the WhatsApp button.
const CONTACT_LABELS = [
  ['email', 'Email address', 'Shown everywhere and used by the enquiry form.'],
  ['email2', 'Second email address', 'Also shown on the contact page, footer and privacy policy. Empty hides it.'],
  ['phoneDisplay', 'Phone (as shown)', 'How the number is written on the site, e.g. +975 17 53 93 34.'],
  ['phoneTel', 'Phone (for dialling)', 'Same number with no spaces, starting with +.'],
  ['whatsapp', 'WhatsApp number', 'International number, digits only (no + or spaces). Empty hides every WhatsApp button.'],
  ['whatsappLink', 'WhatsApp Business link', 'Official link such as https://wa.me/message/… used by the WhatsApp button, footer and contact page. Empty uses the number instead.'],
  ['office', 'Office location', 'e.g. Thimphu, Bhutan'],
  ['licence', 'Tour operator licence no.', ''],
  ['instagram', 'Instagram link', 'Full address (https://…). Empty hides the link.'],
  ['facebook', 'Facebook link', 'Full address (https://…). Empty hides the link.'],
  ['tripadvisor', 'TripAdvisor link', 'Full address (https://…). Empty hides the link.'],
]
export const CONTACT_FIELDS = [
  ...CONTACT_LABELS.filter(([k]) => k in CONTACT),
  ...Object.keys(CONTACT).filter(k => !CONTACT_LABELS.some(([c]) => c === k)).map(k => [k, human(k), '']),
]

// Matches :root in the website's src/styles.css
export const COLORS = [
  ['--paper', 'Page background', '#091428'],
  ['--ivory', 'Surface', '#0e1e3b'],
  ['--sand', 'Card background', '#12274b'],
  ['--forest', 'Deep section background', '#0c2145'],
  ['--charcoal', 'Main text', '#eaf3fc'],
  ['--muted', 'Secondary text', '#a3b8d1'],
  ['--gold', 'Accent (buttons, highlights)', '#5bb8f0'],
  ['--gold-dark', 'Accent, lighter', '#83cfff'],
  ['--navy-ink', 'Text on light buttons', '#071327'],
]

// Labels for this site's data fields (added to the generic ones in data.js).
export const SITE_FIELD_LABELS = {
  introBlocks: 'Introduction (full text)', blocks: 'Day text', facts: 'Day facts (distance, time, altitude)',
  season: 'Best time to travel', maxAltitude: 'Highest point', trekDays: 'Trekking days', accommodation: 'Accommodation',
  excluded: 'Not included', calendar: 'Festival calendar', calendarYear: 'Calendar year', sections: 'Guide sections',
  sectionsTitle: 'Guide sections heading (two lines)', closing: 'Closing paragraph', itineraryNote: 'Itinerary note',
  author: 'Author (team member)', date: 'Date shown on the story', role: 'Role', bio: 'Biography', photo: 'Photo',
  name: 'Name', related: 'Related journeys (slugs)',
}
