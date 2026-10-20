# Rixos AI Concierge · proposal demo

A presentation-ready demo of an AI concierge for **Rixos Bab Al Bahr, Al Marjan Island, Ras Al Khaimah**. Guests write in their own words; the concierge answers from approved hotel information, turns each message into tickets for the right department, keeps the guest updated, asks for a rating, and hands over to a person whenever it should.

Prepared by Ahmed Elsayyad for the General Manager, senior management and IT.

> This is a separate copy of the SO/ Al Marjan Island concierge demo. It has its own code, its own address and its own data, so changes here never affect the SO/ version.

> **This is a proposal demo.** It runs entirely in the browser on GitHub Pages: a scripted offline concierge stands in for Claude, and all data stays on the device. Hotel details marked **Sample content** are placeholders.

## Screens

| Route            | What it shows                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `#/`             | Landing page with entry points, a QR code for the guest app and “How it works”                                                                                           |
| `#/guest`        | Mobile guest app: sign-in with room number and surname, then chat, services grid, live request tracker, English and Arabic (right to left)                               |
| `#/staff`        | Staff board: **Requests** (12 department tabs, timer rings, actions, escalation, search, filters), **Guest chats** (reply, take over, hand back) and **In-house guests** |
| `#/insights`     | Management view: open vs completed, time to accept and complete, escalations, top 10 requests, ratings, dining orders                                                    |
| `#/present`      | Split screen (phone + board) with a guided six-step demo and a reset button                                                                                              |
| `#/architecture` | For IT: animated layer diagram, security notes, three-phase rollout                                                                                                      |
| `#/admin`        | Settings: response standards, outlet hours, full knowledge-base editor, reset demo data                                                                                  |

Demo access:

- **Guests:** room number and surname of anyone on the in-house list (for example room `1207`, surname `Mitchell`), or the “Continue as Sarah Mitchell” link on the sign-in screen.
- **Staff board:** any department, PIN `1234`.
- **Settings:** password `rixos-admin-2026`. This only keeps casual viewers out. A static site cannot protect anything for real; the pilot uses staff single sign-on.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev            # http://localhost:5173
```

| Command                                                       | Purpose                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run build`                                               | Type-check and build to `dist/`                                                                              |
| `npm run preview`                                             | Serve the production build                                                                                   |
| `npm test`                                                    | Unit tests (Vitest): routing, escalation timing, tool validation, data masking, English and Arabic scenarios |
| `npm run e2e`                                                 | End-to-end tests (Playwright): every guided-demo scenario, mobile and desktop viewports, English and Arabic  |
| `npm run lint` / `npm run format:check` / `npm run typecheck` | ESLint, Prettier, TypeScript strict                                                                          |
| `npm run qr -- <url>`                                         | Write a printable QR code for the guest app to `docs/guest-qr.png`                                           |

## Publish on GitHub Pages

1. Create the repository (for example `rixos-ai-concierge`) and push `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml` (tests, build, deploy). The site appears at `https://<your-user>.github.io/rixos-ai-concierge/`.
4. Make the QR code for the printed handout: `npm run qr -- https://<your-user>.github.io/rixos-ai-concierge/#/guest`.

The app uses hash routes and relative asset paths, so it works from any Pages sub-path without extra configuration. `.github/workflows/ci.yml` runs the full quality checks on every pull request.

GitHub Pages on a free account needs a public repository. Nothing secret is in this repository.

## How the offline concierge works

`src/ai/engine.ts` is a deterministic engine that does what the live Claude tools will do, so the demo never depends on a network:

- **Free text, several requests:** “The AC is loud, send two towels and book a table for 8” becomes an Engineering ticket (detail: noisy), a Housekeeping ticket (2 towels) and a booking that asks for the one missing detail (party size).
- **Catalogue:** every item in the brief's request catalogue (`src/domain/catalogue.ts`) is both a services-grid option and a phrase it understands, in English and Arabic (including Arabic dual forms such as منشفتين = two towels).
- **Never guesses:** answers come only from `src/data/knowledge.json`; unknown questions go to the ambassador.
- **People for sensitive matters:** complaints, unhappy tone, medical, security, refunds, compensation, valuables and other guests are handed to a person. Emergencies show guidance and alert Security and the Duty Manager.
- **Dining orders** are read back, allergies flagged, and placed only after a clear “yes”.
- **Privacy:** card, passport and Emirates ID numbers are masked before storage, with a reminder to the guest.
- **Prompt injection** attempts are declined.
- **Validation:** every request passes the same zod tool schemas (`src/domain/tools.ts`) the live AI function will use, before a ticket exists.

Replies are in English or Arabic. Other languages are detected and answered in English with a note; the live AI answers in any language.

## How guests sign in

1. The front office adds the guest under **Staff board → In-house guests** (title, name, room, arrival, departure, ambassador). In a pilot this list comes from the property management system.
2. The guest scans the QR code in the room or at check-in. **Sign-in link** on each row copies a link with the room number already filled in (`#/guest?room=1207`), so the guest types only their surname.
3. The guest enters room number and surname, accepts the privacy note and taps **Start**. The stay must be current (today between arrival and departure, UAE time). Room numbers ignore leading zeros; surnames ignore case, spaces and accents.
4. The phone stays signed in as that guest until they tap the sign-out icon or the front office presses **Check out**, which ends access and shows “Your stay has ended”.

Each guest has their own chat and request list. The “Continue as Sarah Mitchell” link is for presentations; it disappears when Sarah (a sample guest) is checked out.

## How staff handle chats

- **Guest chats** lists every conversation. Chats that need a person (a complaint, a medical or safety concern, a low rating, a request for the ambassador, or a guest writing while a person is in charge) are marked **Needs a person**, sorted first, counted in red on the tab, and announced with a soft chime.
- Replying, or pressing **Take over**, puts that staff member in charge. The guest is told by name, and the AI stays quiet (except for emergencies and card-number masking) until staff press **Hand back to AI**.
- The same chat is available from any ticket (open the ticket, then **Guest conversation**), so staff can also message a guest first.
- Marking the last person-needed ticket as **Done** clears the “Needs a person” flag.

## Data and sync across devices

A guest on a phone and staff on a laptop see the same data, live, through Supabase (Mumbai region, free plan). The free plan allows two projects and both are in use, so this copy keeps its data in its **own record** (`rixos-live`) inside the **so-ai-concierge** project. It never reads or writes the SO/ record; to give Rixos its own project, upgrade the Supabase plan or pause an unused project, create the project, apply `supabase/migrations/0002_demo_state_sync.sql`, and change the URL and key in `src/store/supabaseTransport.ts`.

- The whole demo is one record (`demo_state`, id `rixos-live`) with a revision number. Each change shows on screen at once, then is sent with the revision it was based on. If another device changed something first, the app reloads the latest state, replays its pending changes on top and sends again, so nothing is lost (`src/store/remote.ts`).
- Other devices are told through Supabase Realtime, with a 10-second check as a fallback if a network blocks live updates.
- The browser holds only the publishable key. It can read the demo record and write only through `commit_demo_state`, which checks the revision, shape and size (`supabase/migrations/0002_demo_state_sync.sql`). Anyone with the link can still change or reset the demo, which is fine for a proposal but not for real guest data.
- A badge in the header shows **Live on all devices**, **Offline · this device only** or **This device only**. If Supabase is unreachable the demo keeps working on the device and catches up when the connection returns.
- **Reset** clears the demo on every connected device.
- Add `?local` before the `#` in the address (for example `…/rixos-ai-concierge/?local#/present`) to run on this device only, without the database.

The local store (`src/store/store.ts`) still keeps a copy in `localStorage` and, in device-only mode, syncs tabs with `BroadcastChannel`. One tab per device (chosen with the Web Locks API) runs the escalation clock.

## Go-live checklist

What works today is right for the presentation and for a small pilot with **test guests or staff acting as guests**. Before real guests use it, these must be done:

| Area               | Today                                                                        | Needed for real guests                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest data privacy | One shared record that anyone with the link could read (names, rooms, chats) | Per-guest records with row-level security and server-side sign-in checks (`supabase/migrations/0001_pilot_schema.sql` is the starting design, not applied) |
| Staff sign-in      | Shared demo PIN `1234`                                                       | Individual staff accounts (Supabase Auth or the hotel's single sign-on), with roles per department                                                         |
| In-house list      | Typed in by the front office                                                 | Fed from the property management system, with check-out removing access automatically                                                                      |
| AI                 | Offline concierge in the browser (English and Arabic)                        | Claude through a server function (`claude-haiku-5-5` by default) with the key held server-side; needs a host with server functions such as Netlify         |
| Content            | Sample outlets, hours, menus, policies                                       | Approved hotel content entered in Settings                                                                                                                 |
| Compliance         | Not reviewed                                                                 | Privacy notice, retention period and UAE PDPL (Federal Decree-Law 45 of 2021) review with the data protection lead and IT                                  |
| Scale              | Fine for a demo and a few rooms                                              | Per-guest tables (above) so every room does not share one record                                                                                           |

`.env.example` lists the variables a pilot needs and where each may live.

## Sample content and what still needs real hotel data

The only fact used is the location (Al Marjan Island, Ras Al Khaimah, UAE). The room count is left blank until the hotel confirms it. Everything else is a placeholder:

- Outlet names, types, opening hours and dress codes (four generic outlets)
- Check-in and check-out times, late check-out, pets, smoking and dress-code policies
- Wi-Fi network name and sign-in method
- Spa hours, treatment list, in-room massage availability; gym, classes, sauna and steam hours
- Pool and beach hours, towels, cabanas; kids' club hours and ages, babysitting, activity schedule
- Transport options and parking
- In-room dining hours and the full menu (dishes, dietary tags, allergens, options). No prices are shown.
- Contact points and emergency instructions
- Staff names (Nadia, Maria, Rajesh and others), the sample guest (Sarah Mitchell, room 1207) and other rooms
- Response standards for Laundry, Recreation, IT & AV and Duty Manager (the brief did not define them)
- Seven days of generated history on Insights (toggle “Live demo only” to hide it)

Edit all of it in Settings (`#/admin`) or `src/data/knowledge.json`, and set `"sample": false` on each section once it is approved. The “Sample content” badge disappears when nothing sample remains.

## Brand

No logo file has been supplied yet, so a plain text placeholder (“RIXOS / BAB AL BAHR”) is shown; the brand mark is not drawn or imitated. Put the official file in `public/brand/` and set `LOGO_SRC` in `src/components/ui/Logo.tsx`. Colours and type use the same neutral palette as the SO/ demo (ivory, sand, warm black, bronze; Cormorant Garamond and Rubik, with Noto Naskh Arabic for Arabic) until Rixos brand guidelines are provided.

## Running cost (approximate)

**This demo: no cost.** GitHub Pages and the Supabase free plan; no AI calls.

For the phase 2 pilot, AI cost from Anthropic's published API prices (Claude Haiku 5.5: $0.10 per million input tokens, $0.50 per million output tokens; Claude Sonnet 5.5: $2 and $10). The assumption is about 6,000 input tokens per turn (instructions, knowledge base and tools) and 300 output tokens, before prompt-caching savings:

| Usage                                                            | Turns per month | Haiku 5.5 | Sonnet 5.5 |
| ---------------------------------------------------------------- | --------------- | --------- | ---------- |
| Demo and pilot testing (300 chats × 8 turns)                     | about 2,400     | about $2  | about $36  |
| Whole hotel (about 180 occupied rooms × 2 chats a day × 6 turns) | about 65,000    | about $50 | about $970 |

Prompt caching of the fixed instructions and knowledge base reduces the input share substantially. Database and hosting for a pilot usually fit within the free tiers of Supabase and Netlify; check their current pricing pages before committing, as plans change.

## Quality checks (latest run)

- TypeScript strict, ESLint and Prettier clean; no console errors in any tested flow
- 38 unit tests (including cross-device sync against a simulated server) and 33 end-to-end tests passing on phone and desktop sizes (Present mode runs on desktop only), covering sign-in, check-out, separate guest chats, staff replies and every guided-demo scenario in English and Arabic
- Lighthouse (mobile) on `/` and `/guest`: Accessibility, Best Practices and SEO 100; Performance 91 on `/` and 89–96 on `/guest` across three runs (the sign-in screen sits right at the 90 target)
- Respects `prefers-reduced-motion`; keyboard navigable with visible focus; live regions for new messages

## Project structure

```
src/
  ai/           offline concierge engine, text understanding, knowledge-base answers
  domain/       types, departments, request catalogue, escalation, tool schemas, data masking
  data/         knowledge.json (sample), knowledge schema, demo guest and sample history
  store/        local store synced across tabs
  components/   guest app, chat cards, staff board, shared UI
  pages/        one file per route
  demo/         guided demo script used by Present mode
tests/unit      Vitest
tests/e2e       Playwright
supabase/       pilot schema (phase 2)
```
