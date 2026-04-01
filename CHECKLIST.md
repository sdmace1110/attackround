# D&D Combat Tracker — Build Checklist
> Work through each phase top to bottom. Check off items as you go. Do not start the next phase until the smoke test at the bottom of the current one passes.

---

## General Rules (apply to every phase)

- [ ] Every new backend file uses `async/await` — no synchronous DB calls, ever
- [ ] Every DB schema change gets an Alembic migration — never alter tables manually
- [ ] Every new endpoint is tested in Swagger UI (`localhost:8000/docs`) before wiring to the frontend
- [ ] Frontend never calls the API directly from a component — all calls go through a Zustand store action
- [ ] Never hardcode `localhost` in frontend code — always use `import.meta.env.VITE_API_URL`
- [ ] Commit to Git at the end of every working session

---

## Phase 1 — Foundation
**Goal: All three containers running; DM can log in from the browser.**

### Repo & Project Structure
- [ ] Create GitHub repo; clone locally
- [x] Create monorepo folders: `/backend` and `/frontend` at the root
- [x] Create root `.env` from the template below (fill in real values):
  ```
  DATABASE_URL=postgresql+asyncpg://dnduser:dndpass@db:5432/dndtracker
  SECRET_KEY=changeme
  VITE_API_URL=http://localhost:8000
  VITE_WS_URL=ws://localhost:8000
  ```
- [x] Create `.env.example` with the same keys but blank/placeholder values — commit this, not `.env`
- [x] Add `.env` to `.gitignore`

### Backend Scaffold
- [x] Create `backend/requirements.txt` with: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `PyJWT`, `bcrypt`, `pydantic`
- [x] Create `backend/main.py` — FastAPI app init, CORS middleware, router registration stubs
- [x] Create empty folders: `routers/`, `models/`, `schemas/`, `db/`, `services/`, `utils/`
- [x] Create `backend/Dockerfile` — base `python:3.11-slim`; install requirements; CMD runs `uvicorn main:app --host 0.0.0.0 --port 8000`

### Database & Migrations
- [x] Create `backend/db/database.py` — async SQLAlchemy engine using `DATABASE_URL` from env; session factory
- [x] Run `alembic init db/alembic` inside the backend folder
- [x] Edit `alembic.ini` and `env.py` to use the async engine and read `DATABASE_URL` from env
- [x] Create `models/user.py` — `users` table: `id` (uuid PK), `email`, `hashed_password`, `created_at`
- [x] Write and run first migration: `alembic revision --autogenerate -m "users"` → `alembic upgrade head`
- [x] Verify table exists: connect to Postgres container and run `\dt`

### Auth Endpoints
- [x] Create `utils/auth.py` — `hash_password()`, `verify_password()`, `create_token()`, `decode_token()` using `PyJWT`; sign with `SECRET_KEY`; 24hr expiry for DM tokens
- [x] Create `routers/auth.py` — `POST /auth/register` (email + password → hashed, stored, returns 201) and `POST /auth/login` (verify password → return JWT)
- [x] Create Pydantic schemas in `schemas/auth.py` for register and login request/response bodies
- [x] Register `auth` router in `main.py`
- [x] **Test in Swagger:** register a user → log in → confirm JWT comes back

### Frontend Scaffold
- [x] Run `npm create vite@latest frontend -- --template react` inside the project root
- [x] Install dependencies: `npm install axios react-router-dom zustand`
- [x] Install and configure Tailwind CSS (follow Tailwind + Vite guide)
- [x] Edit `vite.config.js` — add `server: { host: '0.0.0.0', port: 5173 }`
- [x] Create `frontend/Dockerfile` — node base image; install deps; CMD runs `npm run dev`
- [x] Create `src/services/api.js` — Axios instance pointing to `import.meta.env.VITE_API_URL`; add request interceptor to attach JWT from localStorage
- [x] Create `src/store/authStore.js` — Zustand store: `token`, `user`, `login()`, `logout()`
- [x] Create `src/pages/DmLoginPage.jsx` — simple email/password form; calls `authStore.login()`; redirects to `/dm/dashboard` on success
- [x] Create `src/pages/DmDashboardPage.jsx` — stub page, just renders "Dashboard" text for now
- [x] Create `src/router/index.jsx` — React Router v6 routes; wrap `/dm/*` routes in a `ProtectedRoute` component that checks for a valid JWT

### Docker Compose
- [x] Create `docker-compose.yml` at the root with three services: `db` (postgres:15), `backend`, `frontend`
- [x] `db` service: named volume for persistence; set `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from env
- [x] `backend` service: build from `./backend`; depends on `db`; mounts `.env`; exposes port 8000
- [x] `frontend` service: build from `./frontend`; exposes port 5173
- [~] Create `start-game-night.sh` at the root (portable IP detection script from CONTEXT.md Section 9); make it executable with `chmod +x` — DEFERRED (use `docker compose up` + `ipconfig` manually)

### Phase 1 Smoke Test
- [x] `docker-compose up` — all three containers start with no errors
- [x] `localhost:8000/docs` — Swagger UI loads
- [x] Register a DM account via Swagger
- [x] `localhost:5173` — React app loads in the browser
- [x] Log in as DM via the UI; confirm redirect to dashboard
- [~] Run `./start-game-night.sh`; open the printed IP URL on a phone — app loads — DEFERRED

---

## Phase 2 — Campaign & Roster Management
**Goal: DM can create a campaign and add player characters.**

### Backend
- [ ] Create `models/campaign.py` — `campaigns` table: `id`, `name`, `dm_user_id` (FK to users), `created_at`
- [ ] Create `models/character.py` — `characters` table: `id`, `campaign_id` (FK), `name`, `class`, `level`, `max_hp`, `current_hp`, `status` (`'active'`/`'unconscious'`/`'stable'`/`'dead'`), `created_at`
- [ ] Write and run migration: `alembic revision --autogenerate -m "campaigns_characters"` → `alembic upgrade head`
- [ ] Create `schemas/campaign.py` and `schemas/character.py` — Pydantic request/response models (never expose ORM models directly)
- [ ] Create `routers/campaigns.py`:
  - [ ] `GET /campaigns` — list DM's campaigns (DM JWT required)
  - [ ] `POST /campaigns` — create campaign (DM JWT required)
  - [ ] `GET /campaigns/:id/characters` — list characters
  - [ ] `POST /campaigns/:id/characters` — add character
  - [ ] `PATCH /characters/:id` — edit character (name, class, HP, etc.)
- [ ] Create a `get_current_dm` FastAPI dependency in `utils/auth.py` — decodes JWT, confirms DM role; inject this into all DM-only routes
- [ ] **Test in Swagger:** create campaign → add 3–4 characters → list them → edit one

### Frontend
- [ ] Update `DmDashboardPage.jsx` — fetch and display campaign list; "Create Campaign" button opens a form modal
- [ ] Create `src/pages/CampaignPage.jsx` — character roster table; "Add Character" form (name, class, level, max HP); edit and delete buttons per row
- [ ] Add routes: `/dm/dashboard` → `DmDashboardPage`, `/dm/campaign/:id` → `CampaignPage`
- [ ] All API calls go through store actions — create `src/store/campaignStore.js` for campaign + character state

### Phase 2 Smoke Test
- [ ] Create a campaign via the UI
- [ ] Add all real player characters with correct HP values
- [ ] Edit one character's max HP; confirm it saves
- [ ] Refresh the page; confirm data persists (it's in the DB, not just in state)

---

## Phase 3 — Session Lifecycle
**Goal: DM starts a session; players join on their phones.**

### Backend
- [ ] Create `models/session.py` — `sessions` table: `id`, `campaign_id` (FK), `code` (unique varchar, e.g. `WOLF-7`), `status` (`'active'`/`'ended'`), `started_at`, `ended_at`
- [ ] Write and run migration: `alembic revision --autogenerate -m "sessions"` → `alembic upgrade head`
- [ ] Create `utils/codes.py` — generates `WORD-N` style codes; retries up to 5 times on DB uniqueness collision; raises `409` after 5 failures
- [ ] Add to `routers/sessions.py`:
  - [ ] `POST /sessions` — generates code, creates session row, returns code (DM JWT required)
  - [ ] `GET /sessions/:code` — returns full session state (used on reconnect)
  - [ ] `PATCH /sessions/:id/end` — sets status to `'ended'`, records `ended_at`
- [ ] Add `POST /auth/session-join` to `routers/auth.py` — validates session code exists and is active; returns a scoped player JWT (include `session_id` and `character_name` in payload; shorter expiry — 12hr)
- [ ] Create `services/session_manager.py` — `ConnectionManager` singleton: `connect()`, `disconnect()`, `broadcast_to_room()`, `notify_player()` methods; rooms keyed by session code
- [ ] Create `routers/websocket.py` — `WS /ws/{session_code}` endpoint: validates JWT from `?token=` query param; adds connection to room; sends full session state on connect; handles disconnect cleanup
- [ ] Register websocket router in `main.py`

### Frontend
- [ ] Update `src/pages/LandingPage.jsx` — two paths: "Join a Session" (code entry form) and "DM Login" link
- [ ] Player join flow: enter session code → select character name → `POST /auth/session-join` → store scoped JWT → redirect to `/session/:code`
- [ ] Create `src/pages/SessionPage.jsx` — reads JWT to detect role (DM or player); renders the correct layout (stubs for now — just role label + session code)
- [ ] Create `src/services/websocket.js` — opens `WS` connection with token; reconnect loop with exponential backoff (1s, 2s, 4s, 8s max); routes incoming messages to the appropriate store action
- [ ] Update `src/store/sessionStore.js` — `sessionCode`, `connectedPlayers`, `role`; populate from WS `connect` payload
- [ ] DM dashboard: "Start Session" button per campaign → calls `POST /sessions` → redirects DM to `/session/:code`
- [ ] DM session view topbar: shows session code badge + list of connected player names (updates live via WS)

### Phase 3 Smoke Test
- [ ] DM starts a session from the dashboard; session code appears (e.g. `WOLF-7`)
- [ ] Open the LAN URL on 2–3 phones; join with the code and different character names
- [ ] All player names appear in the DM's topbar in real time
- [ ] Kill the WS connection on one phone (airplane mode briefly); confirm it reconnects and re-appears
- [ ] Confirm a second session code collision attempt returns a proper error (test via Swagger)

---

## Phase 4 — Combat Event Logging
**Goal: Players and DM can log actions; all clients update live.**

### Backend — Schema
- [ ] Create `models/encounter.py` — `encounters` table: `id`, `session_id` (FK), `name`, `round_num`, `initiative_locked` (bool), `started_at`, `ended_at`
- [ ] Create `models/npc.py` — `npcs` table (full schema per CONTEXT Section 4.4)
- [ ] Create `models/initiative_submission.py` — `initiative_submissions` table (CONTEXT Section 4.2)
- [ ] Create `models/combat_event.py` — `combat_events` table (full schema per CONTEXT Section 4.3 — all columns)
- [ ] Write and run migration: `alembic revision --autogenerate -m "combat_tables"` → `alembic upgrade head`
- [ ] Verify all tables and columns in Postgres before writing any endpoints

### Backend — Endpoints
- [ ] `routers/sessions.py`: add `POST /sessions/:id/encounters` and `PATCH /encounters/:id/end`
- [ ] `routers/sessions.py`: add `POST /encounters/:id/initiative` (player roll submission — not a combat event; broadcasts `initiative_update` WS message to DM), `PATCH /encounters/:id/initiative-order`, `PATCH /encounters/:id/initiative-lock`
- [ ] Create `routers/npcs.py`: `POST /encounters/:id/npcs`, `PATCH /npcs/:id`, `GET /encounters/:id/npcs`
- [ ] Create `routers/events.py`: `POST /events` — main event logging endpoint:
  - [ ] Persist event row
  - [ ] Call `services/hp.py` to auto-update `current_hp` on target (clamp 0–max_hp)
  - [ ] Call `services/death_saves.py` if event_type is `death_save`
  - [ ] Call `services/stats.py` to recompute `session_stats`
  - [ ] Call `services/broadcast.py` — full room broadcast for player events; targeted notify for NPC-to-player events
  - [ ] Set `is_friendly_fire = True` server-side if `actor_type == 'player'` and `target_character_id` is non-null
  - [ ] Set `is_killing_blow = True` server-side if target HP reaches 0
- [ ] Create `services/hp.py` — `update_hp(target_id, target_type, delta)`: reads current HP, applies delta, clamps to 0–max_hp, writes back; sets `is_alive = False` and `slain_round` on NPC death
- [ ] Create `services/death_saves.py` — `process_death_save(character_id, session_id, outcome)`: counts successes/failures; auto-sets `characters.status` to `'stable'` or `'dead'` on third; broadcasts result
- [ ] Create `services/stats.py` — `recompute_session_stats(session_id)`: aggregates `combat_events` into `session_stats` rows per character
- [ ] Create `services/broadcast.py` — `broadcast_to_room(session_code, payload)` and `notify_player(session_code, character_id, payload)`
- [ ] Add `GET /sessions/:id/stats` and `GET /encounters/:id/stats` — return same Pydantic schema, filtered by scope

### Frontend — Player View
- [ ] Build `src/components/player/ActionForm.jsx` (five tabs: Attack / Spell / Heal / Dmg taken / Death save)
  - [ ] Attack tab: target dropdown (NPCs only by default) + friendly fire toggle; toggle expands dropdown to include other player characters; toggle resets to `false` on submit (`useState`)
  - [ ] Heal tab: target dropdown always shows all player characters including self — no toggle
  - [ ] Spell, Dmg taken, Death save tabs: fields per CONTEXT Section 5.3
- [ ] Build `src/components/player/CharacterCard.jsx` — name, class, level, current HP bar, editable HP field
- [ ] Build `src/components/player/IncomingDamageToast.jsx` — appears on NPC-to-player damage WS message; auto-dismisses after 5 seconds
- [ ] Build `src/components/player/PersonalStats.jsx` — damage dealt, healing done, kills; updates on each WS event
- [ ] Build `src/components/player/GroupMeter.jsx` — compact horizontal bars for all characters; own bar highlighted
- [ ] Wire initiative prompt: when WS delivers `initiative_prompt` message, show a number input overlay; submit calls `POST /encounters/:id/initiative`

### Frontend — DM View
- [ ] Build `src/components/dm/InitiativeTracker.jsx`:
  - [ ] Shows all player + NPC rows interleaved by initiative value
  - [ ] Player rows populate in real time as `initiative_update` WS messages arrive
  - [ ] DM enters NPC initiative values via inline number inputs
  - [ ] Drag-to-reorder using `@dnd-kit/sortable`; on drop calls `PATCH /encounters/:id/initiative-order`
  - [ ] "Lock initiative" button calls `PATCH /encounters/:id/initiative-lock` and begins combat
  - [ ] Active turn highlighted purple (player) or amber (NPC)
  - [ ] Unconscious players shown in red with death save tally
  - [ ] Slain NPCs shown grayed/struck-through with round slain
  - [ ] Prev/next round buttons; advance broadcasts `round_advance` WS message
- [ ] Build `src/components/dm/NpcPanel.jsx` — collapsible NPC cards (amber theme); one expanded at a time; "Add NPC" button
- [ ] Build `src/components/dm/NpcCard.jsx` — name, CR, HP/max, AC, legendary badge; expands to `NpcActionForm`
- [ ] Build `src/components/dm/NpcActionForm.jsx` — same five tabs as player form, amber theme; target dropdown shows player characters; note appears when player selected
- [ ] Build `src/components/dm/EventFeed.jsx` — scrolling log, newest top; badges per event type; NPC events in amber; `FF Hit`/`FF Miss` in coral; corrected events struck through
- [ ] Build `src/components/dm/StatsStrip.jsx` — pinned bar: Party dmg | NPC dmg | Heals | Hit rate
- [ ] Note: `ActionForm` and `NpcActionForm` share logic via `BaseActionForm.jsx` with a `theme` prop (`'purple'` or `'amber'`)

### Phase 4 Smoke Test
- [ ] DM starts an encounter; initiative prompts appear on all player phones
- [ ] All players submit initiative rolls; order appears in DM tracker in real time
- [ ] DM adds 2 NPCs with HP values; sets their initiative
- [ ] DM locks initiative; combat begins
- [ ] A player logs an attack hit with damage — all connected clients see it in the event feed
- [ ] DM logs an NPC attack targeting a player — toast appears on that player's phone only
- [ ] Confirm targeted player's HP auto-decrements in the tracker
- [ ] A player toggles friendly fire; targets another player — `FF Hit` badge appears in DM feed
- [ ] A player heals another player — healed player gets a toast; HP increments
- [ ] Damage an NPC to 0 HP — NPC marked dead in tracker; `slain_round` recorded
- [ ] Submit a death save for an unconscious player; confirm auto-resolution on third roll
- [ ] Check `GET /sessions/:id/stats` in Swagger — numbers match what was logged

---

## Phase 5 — Live Scoreboard & Charts
**Goal: Full live chart dashboard visible and updating in real time.**

### Frontend
- [ ] Install Recharts: `npm install recharts`
- [ ] Build `src/components/charts/DamageMeter.jsx` — horizontal bar chart, all characters, purple color ramp; updates on each WS event via `eventsStore`
- [ ] Build `src/components/charts/HealingChart.jsx` — bar chart, teal ramp
- [ ] Build `src/components/charts/KillLeaderboard.jsx` — ranked card list; character name, kill count, victim names
- [ ] Build `src/components/charts/AccuracyChart.jsx` — hit % per character; bar chart
- [ ] Build `src/components/charts/SpellSchoolBar.jsx` — segmented bar by school
- [ ] Build `src/components/charts/DamageTypeChart.jsx` — stacked bar per character by damage type
- [ ] Build `src/pages/ScoreboardPage.jsx` (`/session/:code/scoreboard`):
  - [ ] No auth required — accessible by session code only
  - [ ] Live pulsing indicator + session name in header
  - [ ] Session / encounter toggle with encounter selector dropdown
  - [ ] All six chart components laid out on the page
  - [ ] All charts subscribe to `eventsStore` — update on each WS event without page refresh
- [ ] Add "Push scoreboard" button to DM topbar — broadcasts `{"type": "redirect", "url": "/session/:code/scoreboard"}` via WS
- [ ] Handle `redirect` message type in `websocket.js` — calls `navigate(url)` via React Router `useNavigate()`
- [ ] Add personal stats card and group meter to the player view (components built in Phase 4, now wired to real data)

### Phase 5 Smoke Test
- [ ] Navigate to `/session/:code/scoreboard` directly — page loads without logging in
- [ ] Log several combat events; confirm all charts update live without refreshing
- [ ] Toggle between session view and per-encounter view; numbers change correctly
- [ ] DM clicks "Push scoreboard" — all player phones navigate to the scoreboard automatically
- [ ] Disconnect a player's phone and reconnect — scoreboard reflects current stats on rejoin

---

## Phase 6 — DM Corrections & Session End
**Goal: DM can fix mistakes; session ends cleanly with a summary.**

### Backend
- [ ] Create `models/event_correction.py` — `event_corrections` table (CONTEXT Section 4.5)
- [ ] Write and run migration: `alembic revision --autogenerate -m "event_corrections"` → `alembic upgrade head`
- [ ] Add `POST /events/:id/correct` to `routers/events.py`:
  - [ ] Creates row in `event_corrections` with `field_changed`, `old_value`, `new_value`, optional `reason`
  - [ ] Sets `combat_events.is_corrected = True` on the original row
  - [ ] Recomputes `session_stats`
  - [ ] Broadcasts corrected event to all room members with `is_corrected` flag
- [ ] Update `PATCH /sessions/:id/end`:
  - [ ] Sets `status = 'ended'`, records `ended_at`
  - [ ] Triggers final `session_stats` computation
  - [ ] Broadcasts `session_ended` to all room members
- [ ] **Test in Swagger:** log an event → correct it → confirm both rows exist; check `is_corrected` flag

### Frontend
- [ ] Build `src/components/dm/CorrectionModal.jsx` — opens when DM clicks an event in the feed; shows current values; allows editing one field at a time; optional reason field; submit calls `POST /events/:id/correct`
- [ ] Update `EventFeed.jsx` — corrected events show original value struck through with corrected value below; amber "corrected" badge; every event row is clickable (opens correction modal)
- [ ] Add "End Session" button to DM topbar — confirmation dialog; calls `PATCH /sessions/:id/end`; on WS `session_ended` all clients redirect to `/session/:code/summary`
- [ ] Build `src/pages/SummaryPage.jsx` (`/session/:code/summary`):
  - [ ] Final totals per character
  - [ ] Timeline of encounters with per-encounter stats
  - [ ] MVP badge (most damage, most heals, most kills)

### Phase 6 Smoke Test
- [ ] Log an event with wrong damage value; click it in the feed; correct the value; confirm the feed shows the strikethrough + correction
- [ ] Check `GET /sessions/:id/stats` — corrected value is reflected, not the original
- [ ] DM ends the session; all player phones redirect to summary page
- [ ] Summary page shows correct totals; encounter timeline is accurate
- [ ] After session ends, confirm `PATCH /sessions/:id/end` returns an error if called again (session already ended)

---

## Phase 7 — Campaign Stats & Polish
**Goal: Campaign history works; app is ready for a real game night.**

### Backend
- [ ] Add `GET /campaigns/:id/stats` to `routers/campaigns.py` — aggregate `session_stats` across all sessions in the campaign; return same Pydantic shape as session stats
- [ ] **Test in Swagger:** run stats across 2+ sessions; confirm numbers aggregate correctly

### Frontend
- [ ] Update `CampaignPage.jsx` — add campaign-wide stats section (totals per character across all sessions) using the same chart components from Phase 5
- [ ] Add session history list to `CampaignPage.jsx` — each past session is a row with date, duration, encounter count; click to view that session's summary
- [ ] Polish pass — add to every page:
  - [ ] Loading spinner while data fetches
  - [ ] Error toast when an API call fails (use a simple toast component or library)
  - [ ] Empty state message when lists are empty (no campaigns yet, no characters yet, etc.)
- [ ] DM dashboard: display the LAN IP and mDNS hostname prominently so the DM can read it aloud at the table

### Responsive Layout Audit
- [ ] Open player view in browser DevTools at 390px width (iPhone) — all elements readable, form usable with thumbs
- [ ] Open at 768px (tablet) — two-column grid kicks in for action form + personal stats
- [ ] Open at 1280px (laptop) — centered layout with max-width cap; no horizontal scroll
- [ ] Test the DM three-column layout at 1280px and 1440px — no overflow, all panels usable

### Final Smoke Test (Full Game Night Simulation)
- [ ] Run `./start-game-night.sh` on the host laptop; note the printed LAN URL
- [ ] DM opens the URL and logs in
- [ ] 3–4 players connect on phones using the LAN URL; all join the session
- [ ] DM creates a campaign with all player characters (if not already done)
- [ ] DM starts a session and an encounter; players submit initiative
- [ ] Run a full mock combat: attacks, spells, heals, NPC actions, a death save, a kill
- [ ] DM corrects one event mid-combat
- [ ] DM pushes scoreboard; all phones navigate to it; charts are live
- [ ] DM ends the session; summary page loads on all devices
- [ ] `docker-compose down` — confirm no data errors
- [ ] `docker-compose up` — confirm all campaign data is still present (volume persisted)
- [ ] Do **not** run `docker-compose down -v` — that wipes the volume

---

## Notes
- All UUIDs — never use auto-increment integers for primary keys
- AoE target fields (`target_npc_ids`, `target_character_ids`) are comma-separated UUID strings — parse with `str.split(',')`, never store as a Postgres array
- `characters.status` valid values: `'active'` | `'unconscious'` | `'stable'` | `'dead'`
- WS message types to handle in `websocket.js`: `session_state`, `event`, `initiative_update`, `initiative_prompt`, `round_advance`, `redirect`, `session_ended`
- Cloud migration when ready: swap Postgres container → Neon, deploy backend → Render, deploy frontend build → Netlify; only env vars change, no code changes needed
