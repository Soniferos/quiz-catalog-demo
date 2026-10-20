# Terra v2: purchase and rental quiz demo

Standalone React demo for testing real-estate quiz flows. All inventory, specifications and prices are fictional. Photographs are illustrations, not actual listed properties.

## Run

Node.js 22.12+ (or a supported newer release), npm:

```sh
npm ci
npm run dev -- --port 4180 --strictPort
```

## Hosted demo build

The Vercel deployment uses `npm run build:public-demo`. This mode is a browser-only
demo: phone format checks stay local, WAHA lookup is disabled, and no contact
values leave the browser or enter demo storage. Only anonymous demo funnel data
and test selections (including contact method/type, never the entered destination) are stored in that browser's local storage. Do not use real contacts or client inventory in this deployment. `.vercelignore` excludes local
environment files from the upload.

Open http://127.0.0.1:4180/. The server binds to loopback only.

```sh
npm test
npm run build
npm run preview -- --port 4181 --strictPort
```

`build` generates static files in `dist/`; it does not publish anything.

## Included

- Purchase: four questions following the Polish reference sequence.
- Rental: five steps with dates, guests, type, bedrooms, district and budget.
- Calculated abstract locked preview before the test contact form; immediate catalog unlock. Locked teaser cards do not load underlying property photos.
- Ten sale and eight rental fixtures, filters/search/sort, detail pages and favorites.
- Strict matching, explicit reasons and an empty result without asking for contact.
- USD/THB/RUB using frozen illustrative rates dated 2026-10-20; no PLN or EUR selector.
- WhatsApp/Telegram/call/MAX contact choices with a phone, Telegram username, or MAX profile link as appropriate; later object requests do not ask again.
- Anonymous local leads, same-session deduplication, status changes and JSON export.
- Ordered session funnel, source/device/date filters and answer distributions.
- Separate fictional sample analytics and screen preview excluded from the funnel.
- Responsive desktop/mobile layouts and keyboard-accessible native dialogs.

## Test walkthrough

Open `#sale/start`: choose two bedrooms / $250,000 / personal use / online.
Four matches, three preview cards. Choose $150,000 and three bedrooms for an empty
result. Changing answers invalidates the previous unlock; answers remain editable.

Open `#rental/start`: November 5-12, 2026, two guests, any type/bedrooms/district,
$2,500 for the stay. Seven matches; Lagoon Park is occupied on overlapping dates.
Palm Residence totals $522.75 (display rounded to $523), plus a separate $200
refundable deposit. Bay Studio has unknown availability, explicitly labeled.

Use any test name and the reserved example number `+1 202 555 0123` in the form.
Name stays in browser memory; the number is also revalidated by the local API.
Neither is persisted or exported. External WhatsApp lookup is disabled by default;
when explicitly configured and consented to, the number is sent to WAHA for one
lookup, not as a message. A request is not a confirmed viewing.

The grid icon opens `#sale/admin` or `#rental/admin`. "Учебный пример" loads 36 explicitly fictional
sessions separately from "Мои прохождения". Admin access is intentionally open
because it contains only local demo data; this is not production authentication.

## Adaptation

- `src/config.mjs`: project identity, questions and fixture catalog.
- `src/engine.mjs`: filtering, explanations, phone validation and funnel logic.
- `src/rental.mjs`: test calendars, seasonal rates, stay totals and score calculation.
- `src/phone.mjs`: shared strict international validation and placeholder policy.
- `server/contacts.mjs`, `vite.config.mjs`: local API and optional WAHA adapter.
- `src/store.mjs`: browser-only persistence and whitelisted source attribution.
- `src/App.jsx`: quiz, catalog, detail, inquiry and admin views.
- `src/main.jsx`: React entry point; `src/theme.css`: responsive theme.
- `public/`: local media and font.

Current UI is Russian. On Vercel, `/api/rates` reads the current USD/THB and USD/RUB values from Google Finance pages and caches them for 15 minutes. Displayed amounts round up to the next whole unit using `Math.ceil`. Google documents delayed quotes (up to 20 minutes); it does not offer this page parser as a supported public API, so markup changes or access failures fall back to the demo snapshot (USD=1, THB=33.53, RUB=82.85) and the UI labels that fallback. This is illustrative pricing, not a financial quote.
Configuration is separate from UI, but a real client
copy still needs content/data review and QA, not only changing a project ID.

Browser storage key: `quiz-demo:terra-phuket-demo:v2`; v1 data is left untouched and
not imported. Purchase/rental answers, favorites and unlocks are separate. A lead
is deduplicated by session + profile + selection intent. Clear the key in browser tools to
reset everything. The admin trash button clears events/leads but keeps favorites
and answers. Analytics isolate version 2.0, profile, preview and sample data.
Analytics use this device/browser only, not server totals. Events are
capped at the latest 8,000; long-lived or cross-period cohorts can be incomplete.
The UI date filters use the browser's local time zone; sessions crossing the
selected period boundary may be excluded from the ordered cohort.

Rental calendars cover November 1, 2026 through April 1, 2027 (checkout boundary);
outside that window availability is unknown. Rates include seasonal multipliers,
cleaning and a 5% service fee; deposit is separate. Budgets explicitly mean total
stay or average nightly cost including mandatory fees. Minimum stay and capacity
are hard limits. Saved objects unavailable on new dates stay saved but are hidden
from the request. The sale score uses active criteria weighted 50/35/15 for
bedrooms/budget/purpose; it is not purchase probability or the reference author's
unknown exact algorithm. All-any answers produce no score.

## Phone and WhatsApp checks

The client and local API share `libphonenumber-js/max` metadata: country calling
code, length and valid national ranges. Parsing is strict: it does not extract a
number from arbitrary text. Extensions, letters and missing `+` are rejected.
An additional local anti-placeholder policy rejects a whole national number made
of the same digit, repeating 2-4 digit blocks, or a full ascending/descending
sequence. This is a heuristic, not a subscriber database: vanity numbers can be
flagged; a long run inside an otherwise mixed number is not automatically banned.
Neither this nor WhatsApp registration proves ownership; that would need a separate
verification flow (e.g. OTP), not implemented here. For Telegram, a username is format-checked locally (5–32 characters; letters, digits, underscore) but not looked up. MAX profile links are accepted only on https://max.ru/ paths; their account validity is not checked. Entered destinations are not persisted.

By default `/api/contacts/capabilities` returns `whatsappEnabled: false` and no
number leaves the local app. Configure a connected WAHA instance in an ignored
`.env.local` using `.env.example` as the field reference:

```dotenv
CONTACT_LOOKUP_MODE=waha
WAHA_BASE_URL=https://your-private-waha.example
WAHA_API_KEY=your-server-side-key
WAHA_SESSION=default
```

Restart Vite after changing the environment. Do not use a `VITE_` prefix or put
keys in source/UI. The WAHA account must already be linked and working; this code
does not install WAHA, start sessions, scan QR codes or send messages. HTTP is
accepted only for a loopback WAHA instance; remote connections require HTTPS.

After the user explicitly permits lookup, `POST /api/contacts/check` validates
again, normalizes to E.164 and calls WAHA's `GET /api/contacts/check-exists`.
`numberExists: true/false` becomes `yes/no`; timeout, malformed response and
provider failures become `error`, never `no`. Disabled/unrequested is `unknown`.
For no/error, the user can retry, change number or choose an alternative channel.
The anonymized lead keeps status/provider/time/reason, not phone/chatId/API key.
Known lookup status remains attached when selecting another channel in that form.

The local API limits attempts/concurrency/body size, requires same-origin JSON,
has timeouts and no-store responses. It is not an authenticated production service. The public static Vercel build has no API and therefore has no server-side rate limiting; it stores no contact destinations. A production intake requires a server-side rate limit, bot protection/challenge, idempotency and ownership verification such as OTP where needed.
Do not publicly expose this lookup as a general WhatsApp-number checker. A deployed
pilot needs access/abuse controls, agreed privacy wording, provider/log-retention
review and a controlled end-to-end check using an authorized number. WAHA sees the
queried phone; its own/reverse-proxy logs are outside this app's storage policy.
Static `dist/` alone has no API: keep a Node backend when deploying these checks.

References: [author's post 266](https://t.me/mudr_marketing/266),
[WAHA contacts](https://waha.devlike.pro/docs/how-to/contacts/#check-phone-number-exists),
[WAHA account linking](https://waha.devlike.pro/docs/overview/quick-start/),
[Google validity limits](https://github.com/google/libphonenumber/blob/master/FAQ.md).
The author names WAHA and Google libraries, but not a specific library/version.

## Before a real launch

Only a local contact-check API exists; live WAHA is not configured. No CRM,
AdMirra, ad pixels, email/Telegram delivery, server authentication, production
consent/contact storage or complete anti-spam is connected. No actual API secrets
are included. Phone validity does not establish ownership, reachability or quality.

WhatsApp lookup only indicates whether a provider reports a registered account; it does not verify ownership or consent to message. Before sending any WhatsApp message, collect consent that names the business and the communication expected, record it with time/source, offer opt-out, and use an approved business messaging setup. A production pilot needs a verified client catalog and image rights, current
prices/availability, server-side validation and delivery with retries/idempotency,
project-isolated storage, privacy/consent design, authenticated admin, monitoring,
agreed analytics, HTTPS/domain and an end-to-end delivery/rollback test.
Do not use this local panel for actual client contacts or present this demo as a production service or client result.

## Hosted demo smoke check, 2026-10-20

- Production URL is publicly reachable without a Vercel session. Manual purchase and rental journeys reached their result catalogs using only the form-provided synthetic contact.
- The local demo panel showed the test entry without a saved name or phone and stated that no delivery occurred. Browser storage contained no synthetic name/phone; observed network traffic was limited to static site files, with no API/WAHA requests.
- Analytics and demo entries are stored per browser in local storage, so visits do not aggregate across users or devices.

## Verification, 2026-10-20

- 41 Node tests: matching, strict/placeholder phone validation, HTTP validation,
  WAHA contract/consent/errors/privacy/limits, versioned/profile-isolated funnel,
  deduplication, strict dates, occupied boundaries, capacity/minimum stay, seasonal
  full-price calculation, unknown calendar, explicit budget units and scoring.
- Production build succeeded; `npm audit --omit=dev`: zero vulnerabilities.
- Playwright 320/390/768/1440px: purchase/rental paths, results, catalog filters,
  favorites, gallery/Escape, invalid/valid test form, local funnel, sample data,
  preview, retained answers, blocked dates and empty results. No horizontal overflow in checked
  views; no browser console errors. Screenshots: repository `output/playwright/`.
- Contact additions: actual local API + placeholder rejection, and browser-mocked
  WAHA yes/no/error, consent gate and alternative channel with retained status.
  These mocks do not prove a connected WAHA account; no real phone was queried.

## Assets

Photos downloaded from Unsplash (illustrations). The locked teaser preview now uses CSS artwork and does not reference these source images. For a real catalog, keep gated originals in private storage and only issue an authorized delivery URL; hiding or blurring a public image in CSS is not access control:

- https://images.unsplash.com/photo-1613977257363-707ba9348227
- https://images.unsplash.com/photo-1600210492486-724fe5c67fb0
- https://images.unsplash.com/photo-1600607687920-4e2a09cf159d
- https://images.unsplash.com/photo-1505693416388-ac5ce068fe85
- https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3
- https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7

Manrope from Google Fonts; SIL Open Font License in `public/fonts/OFL.txt`.
Interface icons: lucide-react (ISC).


## 2026-10-20 UI update

- Added USD/THB/RUB selector, four contact channels, Telegram username and MAX profile-link modes. Only contact type/status is saved; entered contact values remain transient.
- Request dialog explicitly opts into dark native date/time controls. Locked teaser cards use CSS art instead of loading photos. This does not protect the public static catalog images: real protected photos require private storage and an authorized server route.
- Local public-demo build succeeds. Production deployment attempt was blocked by Vercel because the Git commit author is not permitted to create project deployments; the public alias still serves the earlier deployment.


## Vercel and GitHub

This application is maintained in the public repository [Soniferos/quiz-catalog-demo](https://github.com/Soniferos/quiz-catalog-demo). The live demo is [quiz-catalog-demo.vercel.app](https://quiz-catalog-demo.vercel.app/). The Vercel project builds from the repository root on `main`; pushes to `main` trigger deployments. This repository contains only the demo application and no Second Brain data.
