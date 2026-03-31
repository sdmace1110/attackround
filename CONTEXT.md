# D&D Combat Tracker — Copilot Context Document
**Version 3.0 | D&D 5e | March 2026**

> This is the source of truth for the project. If a coding decision conflicts with this document, update the document and note the reason. Load this file at the start of every Copilot session.

---

## 1. Project Overview

A web-based real-time combat statistics tracker for a D&D 5e group. The DM and any number of players connect to a shared session during game night to log combat actions. Stats are aggregated live and persist across sessions for campaign-long tracking.

| Field | Value |
|---|---|
| Ruleset | D&D 5th Edition |
| Group size | 1 DM + unlimited players (no hard cap) |
| Device split | Players on any device (phone, tablet, laptop); DM on laptop |
| Session type | Real-time, WebSocket-connected |
| Data scope | Per-session stats + campaign totals |
| Auth model | DM logs in; players join via session code |
| Hosting | Local Docker Compose + local WiFi (direct connection, no tunnel) |

---

## 2. Tech Stack

### Backend
| | |
|---|---|
| Language | Python 3.11+ |
| Framework | FastAPI (async, native WebSocket support) |
| ORM | SQLAlchemy 2.0 (async) with Alembic for migrations |
| Auth | JWT via PyJWT; bcrypt for password hashing |
| WebSockets | FastAPI native WebSocket — one room per active session |
| Hosting | Docker container on host laptop (localhost:8000) |

### Frontend
| | |
|---|---|
| Framework | React 18 with hooks + Vite build tool |
| State mgmt | Zustand (lightweight, hook-based — simpler than Redux for this scope) |
| Charting | Recharts (React-native charting, no wrapper needed) |
| HTTP/WS | Axios for REST; native browser WebSocket API |
| Styling | Tailwind CSS (mobile-first, utility classes) |
| Routing | React Router v6 |
| Served by | Vite dev server in Docker container (host IP:5173) |

### Database
| | |
|---|---|
| Engine | PostgreSQL 15 |
| Hosting | Docker container on host laptop (localhost:5432) |
| Persistence | Docker named volume — data survives container restarts |
| Connection | Async via asyncpg driver |
| Schema mgmt | Alembic migrations, version-controlled |

### Networking — Local WiFi
| | |
|---|---|
| Method | Direct LAN connection — no tunnel or third-party service |
| How it works | DM's laptop binds all services to `0.0.0.0`; players connect via host's local IP or mDNS hostname |
| Player URL | `http://192.168.x.x:5173` or `http://hostname.local:5173` (mDNS — preferred) |
| mDNS hostname | Mac: `hostname.local` always resolves on any LAN without IP lookup |
| Requirement | All devices must be on the same WiFi network |
| WebSockets | Connect directly to `ws://192.168.x.x:8000/ws/...` — no tunnel overhead |
| No internet needed | Entire session runs offline if desired |
| Game night change | Host shares their local IP or mDNS hostname instead of a URL |

### Development Environment
| | |
|---|---|
| IDE | Visual Studio Code |
| AI assistant | GitHub Copilot (Claude via Copilot) |
| Version control | Git + GitHub |
| Full stack | Docker Compose — all services start with one command |
| API testing | FastAPI /docs (Swagger UI at localhost:8000/docs) |
| Env vars | `.env` file at project root, mounted into containers |

---

## 3. Architecture

### 3.1 High-Level Flow

- All services run locally in Docker Compose: React frontend (5173), FastAPI backend (8000), PostgreSQL (5432)
- All services bind to `0.0.0.0` — reachable from any device on the same WiFi network
- Players connect directly to the host laptop's local IP or mDNS hostname — no tunnel, no third party
- Frontend communicates with backend via REST and WebSocket over the local network
- Backend reads/writes to PostgreSQL via async SQLAlchemy
- One WebSocket room exists per active session, keyed by session code
- When a player logs a combat event, the backend persists it then broadcasts to all room members
- When the DM logs an NPC action targeting a player, a targeted notification broadcasts to that player only
- The stats engine recomputes session aggregates on each event; campaign totals update on session end

### 3.2 Authentication Model

- **DM**: registers with email + password; receives JWT (24hr expiry) stored in localStorage
- **Player**: enters session code + character name; receives a scoped JWT for that session only
- No player account creation required — zero friction on game night
- Multiple DMs are fully supported; each DM owns their own campaigns
- DM JWT required for: creating campaigns, managing rosters, starting/ending sessions, editing events, logging NPC actions

### 3.3 WebSocket Reconnection Strategy

- Session state is persisted in PostgreSQL, not in-memory only
- On reconnect, client sends session code + JWT; server rehydrates full session state
- Player rejoins the same room and receives a state-sync payload of all events since join
- Client implements reconnect loop with exponential backoff (1s, 2s, 4s, 8s max) for WiFi drops
- Direct LAN connection is stable; reconnect loop handles brief WiFi interruptions at the router level

### 3.4 NPC Broadcast Rule

NPC actions have selective broadcasting:

- **NPC targets a player**: backend broadcasts a targeted notification to that player's WebSocket connection only. The player sees a toast: *"Lich cast Finger of Death on you — 45 necrotic damage"*. The NPC's HP, stats, and full action log are **not** sent to players.
- **NPC targets another NPC**: no player broadcast fires.
- **NPC action with no specific target**: no player broadcast fires.
- The DM event feed always shows full NPC action details.
- Player event feeds never show NPC HP, AC, CR, or stat information.

### 3.5 Initiative Model — Hybrid

Initiative is a collaboration between players and the DM:

**Player characters — player-submitted:**
- When the DM starts an encounter, all connected players receive a prompt on their device: *"Roll initiative — enter your result"*
- Each player submits their roll via a simple number input; this is a one-time action per encounter, not a combat event
- The backend collects all submissions and sorts the initiative order automatically
- The DM can manually reorder or edit any player's initiative value at any time from the initiative tracker (drag-to-reorder or inline edit)
- Late-joining players can submit initiative after the encounter has started; the DM approves their position

**NPCs — DM-controlled:**
- NPC initiative values are set by the DM when adding an NPC to the encounter or when starting the round
- NPCs are placed in the initiative order via inline number input in the DM's initiative tracker
- The DM can freely reorder NPCs at any time (drag handles or edit field)

**Round advancement:**
- Always DM-controlled via prev/next round buttons in the initiative tracker
- Advancing the round highlights the next character/NPC in order
- The active turn is broadcast to all connected players via WebSocket so phones can show whose turn it is

**Schema impact:**
- `encounters` table gains an `initiative_locked` boolean — false while players are submitting, true once the DM locks the order and combat begins
- A new `initiative_submissions` table stores player rolls: `(id, encounter_id, character_id, roll, submitted_at)`
- `combat_events.initiative_order` stores the final resolved turn position (integer, 1-based)

### 3.6 Friendly Fire — Player Targeting Players

By default, player attack forms only show NPCs as valid targets. A **friendly fire toggle** unlocks player characters as attack targets for edge cases (mind control, PvP moments, AoE that catches allies).

**Toggle behavior:**
- The friendly fire toggle lives in the Attack tab of the player action form
- Default state: **off** — target dropdown shows NPCs only
- When toggled on: target dropdown expands to include all player characters except the actor's own character
- The toggle state is local to the form — it resets to off each time the form is submitted or the tab changes
- Friendly fire events are stored identically to normal attacks in `combat_events` — `target_character_id` is set to the targeted player's character id
- The targeted player receives an incoming damage toast (same mechanism as NPC-to-player damage)
- Friendly fire events are visually flagged in the DM event feed with a distinct badge: `FF Hit` / `FF Miss` in coral color

**Healing always allows player targets:**
- The Heal tab always shows all player characters (including self) as valid targets — no toggle required
- Healing another player broadcasts a notification to the healed player's phone



### 3.7 Resolved Game Logic Decisions

**HP tracking — automatic with DM override:**
- Player character `current_hp` auto-decrements when a damage event is logged against that character, and auto-increments when a heal event targets them
- NPC `current_hp` auto-decrements when a damage event targets that NPC, and auto-increments on heals
- The DM can manually override any character's or NPC's current HP at any time via an inline edit field in the initiative tracker — this fires a `PATCH /characters/:id` or `PATCH /npcs/:id` call directly, not a combat event
- HP never goes below 0 or above `max_hp` — clamped server-side on every update

**Session code collision:**
- Session codes are generated with a uniqueness check against the DB
- If a collision occurs, the backend returns a `409 Conflict` error
- The frontend shows a user-facing error: *"That code is already in use — try again"* with a retry button
- The DM does not need to enter a code manually; the app generates one on each retry

**NPC HP — auto-decrement with DM override:**
- Damage events targeting an NPC auto-decrement `npcs.current_hp` server-side on each `POST /events`
- When `current_hp` reaches 0, `is_alive` is set to `false` and `slain_round` is recorded automatically
- DM can override `current_hp` at any time via inline edit in the NPC panel card — useful for off-screen damage, legendary resistances, or corrections

**Character HP between sessions:**
- When a new session begins, each character's `current_hp` is initialized to the value it held at the end of the previous session (`characters.current_hp` persists in the DB between sessions)
- If a character has no prior session (new campaign or new character), they start at `max_hp`
- The DM can edit any character's starting HP before the first encounter of the session

**AoE spells — comma-separated target list:**
- AoE events (e.g. Fireball hitting three targets) are stored as a single `combat_events` row
- `target_npc_ids` stores a comma-separated list of NPC UUIDs (e.g. `"uuid1,uuid2,uuid3"`)
- `target_character_ids` stores a comma-separated list of player character UUIDs for AoE that catches allies
- `damage_amount` stores the total damage rolled; per-target damage is not tracked separately in v1
- The event feed displays AoE events as: *"Zara cast Fireball → Skeleton 1, Skeleton 2, Cultist (31 fire total)"*
- Stats aggregation sums AoE damage as a single damage_amount against the actor — not split per target

**Scoreboard visibility:**
- `/session/:code/scoreboard` is publicly accessible to anyone with the session code — no auth required to view
- The DM has a "Push scoreboard to all players" button in the topbar — this sends a WebSocket `redirect` message that navigates all connected player clients to the scoreboard URL automatically
- Players can also navigate there themselves at any time by appending `/scoreboard` to their session URL

**Death save resolution — auto with DM override:**
- When a player submits a death save, the backend checks the running total in `death_saves` for that character
- On third success: character `status` is automatically set to `'stable'`; a stabilized notification broadcasts to all players
- On third failure: character `status` is automatically set to `'dead'`; a death notification broadcasts to all players
- The DM can manually override a character's status at any time (e.g. revivify mid-combat) via the initiative tracker

**Multiple encounters per session — with per-encounter stats:**
- A session can have any number of sequential encounters
- The DM ends one encounter and starts another from the initiative tracker panel
- `session_stats` aggregates across all encounters in the session
- Per-encounter stats are available via `GET /encounters/:id/stats` — returns damage, healing, kills, and accuracy broken down by encounter
- The scoreboard shows session totals by default; a toggle switches to per-encounter view
- The end-of-session summary shows a timeline of encounters with stats for each


---

## 4. Database Schema

### 4.1 Table Overview

| Table | Purpose | Key relationships |
|---|---|---|
| `campaigns` | One per DM campaign | Owned by a DM user |
| `characters` | Player characters in a campaign | FK to campaigns |
| `sessions` | A single game night | FK to campaigns |
| `encounters` | A combat encounter within a session | FK to sessions |
| `initiative_submissions` | Player initiative rolls per encounter | FK to encounters, characters |
| `npcs` | Named NPCs per encounter | FK to encounters |
| `combat_events` | Append-only action log (core table) | FK to sessions, characters, npcs |
| `event_corrections` | Audit trail for DM edits | FK to combat_events |
| `death_saves` | Per-character death save tracking | FK to sessions, characters |
| `session_stats` | Materialized rollup per character | Recomputed on each event |

### 4.2 `initiative_submissions` Table

Stores each player's initiative roll for an encounter. One row per character per encounter.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `encounter_id` | uuid FK | Parent encounter |
| `character_id` | uuid FK | Player character who submitted |
| `roll` | int | Initiative roll result |
| `submitted_at` | timestamp | When the player submitted |

### 4.3 `combat_events` — Core Table

Append-only event log. Every player or NPC action creates one row. Never deleted — corrections create a linked row in `event_corrections` instead.

The `actor_type` field determines whether the action was logged by a player (`'player'`) or the DM on behalf of an NPC (`'npc'`).

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `session_id` | uuid FK | Parent session |
| `encounter_id` | uuid FK | Parent encounter (nullable) |
| `actor_type` | varchar | `'player'` or `'npc'` |
| `actor_character_id` | uuid FK | Character performing action (nullable — player actors) |
| `actor_npc_id` | uuid FK | NPC performing action (nullable — NPC actors) |
| `target_character_id` | uuid FK | Single target player character (nullable) |
| `target_character_ids` | varchar | Comma-separated character UUIDs for AoE (nullable) |
| `target_npc_id` | uuid FK | Single target NPC (nullable) |
| `target_npc_ids` | varchar | Comma-separated NPC UUIDs for AoE (nullable) |
| `event_type` | varchar | `'attack'` \| `'heal'` \| `'spell'` \| `'death_save'` \| `'kill'` \| `'damage_taken'` |
| `roll_result` | int | The dice roll value |
| `hit` | boolean | Whether the attack connected |
| `damage_amount` | int | Damage dealt (nullable) |
| `damage_type` | varchar | `'slashing'` \| `'fire'` \| `'necrotic'` \| etc. |
| `damage_taken` | int | Damage received by actor (nullable) |
| `heal_amount` | int | HP healed (nullable) |
| `spell_name` | varchar | Name of spell cast (nullable) |
| `spell_slot_level` | int | 1–9, nullable for cantrips |
| `spell_school` | varchar | `'evocation'` \| `'necromancy'` \| etc. (nullable) |
| `is_friendly_fire` | boolean | True if a player attacked another player character |
| `is_killing_blow` | boolean | True if this action downed the target |
| `round_num` | int | Combat round number |
| `initiative_order` | int | Turn position in this round |
| `broadcast_target_id` | uuid FK | Player character to receive targeted WS notification (nullable) |
| `is_corrected` | boolean | True if a correction entry exists |
| `created_at` | timestamp | Server timestamp of log entry |

### 4.4 `npcs` Table

Note: `current_hp` is auto-decremented/incremented by the backend on each damage/heal event targeting the NPC. DM can override via inline edit.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `encounter_id` | uuid FK | Parent encounter |
| `name` | varchar | Display name (e.g. "Lich", "Skeleton 2") |
| `cr` | varchar | Challenge rating (e.g. "21", "½") |
| `max_hp` | int | Max hit points |
| `current_hp` | int | Current HP — auto-updated on damage/heal events; DM can override |
| `ac` | int | Armor class |
| `is_legendary` | boolean | Whether the NPC has legendary actions |
| `is_alive` | boolean | Set to false automatically when current_hp reaches 0 |
| `slain_round` | int | Round number when slain (nullable — set automatically) |
| `created_at` | timestamp | When added to encounter |

### 4.5 `event_corrections` — Audit Trail

When the DM corrects a player or NPC entry, the original row is flagged (`is_corrected = true`) and a correction row is inserted here. Stats always use the corrected values.

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `original_event_id` | uuid FK | The `combat_event` being corrected |
| `corrected_by` | uuid FK | DM user id |
| `field_changed` | varchar | Column name that was corrected |
| `old_value` | varchar | Original value (serialized) |
| `new_value` | varchar | Corrected value (serialized) |
| `reason` | varchar | Optional DM note |
| `created_at` | timestamp | When correction was made |

---

## 5. Application Structure & UI

### 5.1 URL Structure

| Route | View |
|---|---|
| `/` | Landing page — enter session code or DM login |
| `/dm/login` | DM authentication screen |
| `/dm/dashboard` | DM home — campaign list, start session |
| `/dm/campaign/:id` | Campaign management — roster, session history |
| `/session/:code` | Active session — role-detected view (DM or player) |
| `/session/:code/scoreboard` | Full-screen chart dashboard — shareable on TV |
| `/session/:code/summary` | End-of-session summary screen |

### 5.2 DM View Layout (laptop) — Four Areas

The DM session view is a three-column layout with a stats strip pinned to the bottom of the center column.

```
┌─────────────────────────────────────────────────────────────┐
│  Topbar: session badge · connected players · end session    │
├──────────────┬────────────────────────┬─────────────────────┤
│              │                        │                     │
│  Event feed  │  Initiative tracker    │   NPC action panel  │
│  (left 20%)  │  (center 45%)          │   (right 25%)       │
│              │                        │                     │
│  Scrolling   │  Turn order — players  │  NPC cards (roster) │
│  log of all  │  and NPCs interleaved  │  Tap NPC to expand  │
│  events,     │  with HP bars          │  action log form    │
│  newest top  │                        │                     │
│              ├────────────────────────┤                     │
│              │  Stats strip (pinned)  │                     │
│              │  Party dmg · NPC dmg   │                     │
│              │  Heals · Hit rate      │                     │
└──────────────┴────────────────────────┴─────────────────────┘
```

**Event feed (left panel)**
- Scrolling log of all events, newest at top
- Each event shows: badge (Hit / Miss / Heal / Spell / NPC Hit / NPC Miss), description, timestamp
- NPC events show amber badges to distinguish from player events
- NPC events targeting a player show a sub-line: *"[Player] notified on phone"*
- Corrected events show the original struck through with the correction below
- DM can click any event to open the correction modal

**Initiative tracker (center panel)**
- Full turn order for the current encounter — players and NPCs interleaved by initiative roll
- When a new encounter starts, the DM clicks "Start encounter" — all player phones receive an initiative prompt
- Players submit their roll from their phone; the tracker populates in real time as submissions arrive
- NPC initiative values are entered by the DM directly in the tracker via inline number input
- Each row: initiative number, character/NPC name, class/type label, HP bar, HP fraction
- Active turn highlighted in purple (players) or amber (NPCs)
- Unconscious players highlighted in red with death save indicator
- Slain NPCs shown at the bottom, grayed and struck through, with round slain noted
- Rows are drag-reorderable by the DM; inline edit available for any initiative value
- Round counter with prev/next controls at top; advancing round broadcasts active turn to all players
- Stats strip pinned to bottom: Party dmg | NPC dmg | Heals | Hit rate
- Initiative tracker panel scrolls vertically when character count causes compaction — no hard limit on participants

**NPC action panel (right panel)**
- Amber-themed to visually distinguish from player UI
- Lists all NPCs in the current encounter as collapsed cards
- Each collapsed card shows: NPC name, CR, current HP / max HP, AC, legendary indicator
- Tapping an NPC card expands it to reveal the full action logging form
- Only one NPC card is expanded at a time
- Action form has same five tabs as the player form: Attack, Spell, Heal, Dmg taken, Death
- Target field shows a dropdown of player characters
- When a player is selected as target, a note appears: *"Target player will be notified on their phone"*
- Submit button logs the event and triggers selective WebSocket broadcast if target is a player
- "Add NPC to encounter" button at the bottom of the panel
- Slain NPCs remain visible but grayed out with struck-through name

### 5.3 Player View Layout (responsive — mobile-first)

Single-column stacked layout by default, built mobile-first with Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). No separate codebases or device detection — one component adapts to all screen sizes.

**Breakpoint behavior:**
- **Phone (< 640px)**: single-column stack — character card, action form, personal stats, group meter, all scrolling vertically
- **Tablet (640px–1024px)**: two-column grid where appropriate — action form and personal stats sit side-by-side; character card and group meter remain full-width
- **Laptop (> 1024px)**: centered layout with `max-w-2xl` cap — prevents the form from stretching awkwardly across a full-width screen; player does not see DM panels

1. **Character card** — name, class, level, current HP with editable field, HP bar
2. **Action entry form** — five tab buttons across top (Attack / Spell / Heal / Dmg taken / Death save). Fields below change per tab. Large "Log [action]" submit button.
3. **Incoming damage toast** — appears when an NPC targets this player; shows NPC name, damage amount, damage type. Auto-dismisses after 5 seconds.
4. **My session stats card** — damage dealt, healing done, kills. Updates live via WebSocket.
5. **Group damage meter** — compact horizontal bars for all characters. Player's own bar highlighted. Updates live.

**Player action form tabs:**

- **Attack**: target dropdown (NPCs only by default) + **friendly fire toggle** — when toggled on, dropdown expands to include all other player characters; roll result; hit/miss toggle; damage amount; damage type. Toggle resets to off on each submission.
- **Spell**: spell name, school, slot level, damage or heal amount, damage type, target (NPC or player)
- **Heal**: amount, target dropdown — always includes all player characters (self + allies); no toggle needed
- **Dmg taken**: amount, damage type, source (free text — NPC name)
- **Death save**: success/failure toggle, stabilized/died outcome

### 5.4 Scoreboard View (`/session/:code/scoreboard`)

Full-screen, designed to be displayed on a TV or second monitor at the table. Accessible by any player with the session code — no auth required. DM can push all players to this view via the "Push scoreboard" button in the session topbar.

- Live pulsing indicator + session name + running totals in header
- **Session / encounter toggle** — defaults to session totals; toggle switches to per-encounter breakdown with an encounter selector dropdown
- **Damage meter**: horizontal bar chart, all characters, live-updating, purple ramp
- **Kill leaderboard**: ranked card list with killing blow count and victim names
- **Healing done**: bar chart, teal ramp
- **Hit accuracy %**: bar chart per character
- **Spell school usage**: segmented bar showing school breakdown
- **Damage type breakdown**: per-character stacked bar of damage types dealt
- NPC stats do not appear on the scoreboard — player-facing only

---

## 6. API Endpoint Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | DM registration (email + password) |
| POST | `/auth/login` | DM login — returns JWT |
| POST | `/auth/session-join` | Player join — session code + character name — returns scoped JWT |

### Campaigns & Characters
| Method | Endpoint | Description |
|---|---|---|
| GET | `/campaigns` | List DM's campaigns |
| POST | `/campaigns` | Create campaign |
| GET | `/campaigns/:id/characters` | List characters in campaign |
| POST | `/campaigns/:id/characters` | Add character to campaign |
| PATCH | `/characters/:id` | Update character (HP, class, etc.) |

### Sessions & Encounters
| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions` | Start new session — returns session code (DM only) |
| PATCH | `/sessions/:id/end` | End session — freezes stats (DM only) |
| GET | `/sessions/:code` | Get session state — used on reconnect |
| POST | `/sessions/:id/encounters` | Start a new encounter within session |
| PATCH | `/encounters/:id/end` | End encounter |
| POST | `/encounters/:id/initiative` | Player submits initiative roll |
| PATCH | `/encounters/:id/initiative-order` | DM reorders initiative (full sorted id array) |
| PATCH | `/encounters/:id/initiative-lock` | DM locks initiative and begins combat |

### NPCs
| Method | Endpoint | Description |
|---|---|---|
| POST | `/encounters/:id/npcs` | Add NPC to encounter (name, CR, max HP, AC) |
| PATCH | `/npcs/:id` | Update NPC (HP, is_alive, etc.) |
| GET | `/encounters/:id/npcs` | List NPCs in encounter |

### Combat Events
| Method | Endpoint | Description |
|---|---|---|
| POST | `/events` | Log a combat event (player or NPC) — triggers WS broadcast |
| GET | `/sessions/:id/events` | Get all events for a session |
| POST | `/events/:id/correct` | DM correction — creates audit trail entry |
| GET | `/sessions/:id/stats` | Get computed stats for session (all encounters combined) |
| GET | `/encounters/:id/stats` | Get stats for a single encounter |
| GET | `/campaigns/:id/stats` | Get campaign-wide aggregated stats |

### WebSocket
| Field | Value |
|---|---|
| Endpoint | `WS /ws/{session_code}` |
| Auth | JWT passed as query param on connect: `?token=...` |
| On connect | Server sends full session state payload to new client |
| On player event POST | Server broadcasts event to all room members |
| On NPC event POST | Server broadcasts targeted notification to `broadcast_target_id` only (if set) |
| On correction | Server broadcasts corrected event with `is_corrected` flag |
| On scoreboard push | Server broadcasts `redirect` message to all players → `/session/:code/scoreboard` |
| On session end | Server broadcasts `session_ended`; clients redirect to summary |
| Reconnect | Client retries with exponential backoff (1s, 2s, 4s, 8s max) |

---

## 7. Build Plan & Milestones

> Each phase is independently deployable and testable before moving on.

### Phase 1 — Foundation *(Target: Weekend 1)*
**Milestone: App running end-to-end locally with DB connected.**

- Set up GitHub repo with monorepo structure: `/backend` and `/frontend`
- Backend: FastAPI project scaffold — `main.py`, `routers/`, `models/`, `schemas/`, `db/`
- Database: Alembic init; first migration (users + campaigns tables)
- Auth: `POST /auth/register` and `POST /auth/login` with JWT generation via PyJWT
- Frontend: React 18 + Vite scaffold; Tailwind CSS configured; Zustand store init
- Frontend: DM login screen wired to `/auth/login`; JWT stored; protected route guard
- Docker Compose: write `docker-compose.yml` with `db`, `backend`, and `frontend` services
- Confirm all three containers start cleanly with `docker-compose up`
- Run `start-game-night.sh`; confirm frontend is reachable from a phone on the same WiFi network
- Smoke test: DM can register, log in, and see an empty dashboard via the LAN URL

### Phase 2 — Campaign & Roster Management *(Target: Weekend 2)*
**Milestone: DM can create a campaign and add all player characters.**

- Backend: `campaigns` and `characters` tables + migrations
- Backend: CRUD endpoints for campaigns and characters
- Frontend: DM dashboard — campaign list, create campaign form
- Frontend: Campaign detail screen — add/edit/remove characters (name, class, max HP)
- Frontend: Basic mobile-responsive layout established with Tailwind

### Phase 3 — Session Lifecycle *(Target: Weekend 3)*
**Milestone: DM can start a session; players can join with a code.**

- Backend: `sessions` table + migration; `POST /sessions` generates readable session code (e.g. `WOLF-7`)
- Backend: `POST /auth/session-join` — validates code, returns scoped player JWT
- Backend: WebSocket endpoint `/ws/{session_code}` — room creation, join, broadcast scaffold
- Frontend: Landing page — session code entry form for players
- Frontend: Player join flow — enter code, select character from roster, enter session
- Frontend: DM session view scaffold — three-column layout, live connected-players list
- Frontend: WebSocket client with reconnect logic (exponential backoff)
- Smoke test: DM starts session; 2–3 players join on phones via LAN URL; all see each other connected

### Phase 4 — Combat Event Logging *(Target: Weekend 4)*
**Milestone: Players and DM can log actions; all connected clients see them live.**

- Backend: `encounters`, `npcs`, `initiative_submissions`, `combat_events` tables + migrations (full schema per Section 4)
- Backend: `POST /events` — persist event, trigger WebSocket broadcast
- Backend: `POST /encounters/:id/initiative` — player submits initiative roll; broadcasts updated order to DM tracker
- Backend: Initiative lock endpoint — DM locks order and begins combat
- Backend: `session_stats` materialized rollup — recomputed on each event insert
- Backend: NPC selective broadcast logic — notify `broadcast_target_id` player only
- Backend: Friendly fire flag — set `is_friendly_fire = true` when `target_character_id` is a player character and actor is also a player
- Frontend: Player action entry form — five tabs; Attack tab has friendly fire toggle (default off); Heal tab always shows all player targets
- Frontend: Initiative submission prompt on player phones — simple number input shown when DM starts encounter
- Frontend: DM initiative tracker — hybrid display; player submissions arrive in real time; DM sets NPC values; drag-to-reorder
- Frontend: NPC action panel — NPC cards, expand-to-form, amber styling, add NPC button
- Frontend: Incoming damage toast on player phones — fires for NPC-to-player damage and friendly fire hits
- Frontend: DM event feed — friendly fire events show `FF Hit` / `FF Miss` badge in coral color

### Phase 5 — Live Scoreboard & Charts *(Target: Weekend 5)*
**Milestone: Full live dashboard visible during session.**

- Frontend: Live damage meter bar chart (Chart.js, WebSocket-driven updates)
- Frontend: Player personal stats card — running totals, updates on each WS event
- Frontend: Group scoreboard strip in player view
- Frontend: `/session/:code/scoreboard` full-screen view:
  - Damage meter (horizontal bar, all characters, purple ramp)
  - Kill leaderboard (card list with victim names)
  - Healing done (bar chart, teal ramp)
  - Hit accuracy % per character
  - Spell school usage (segmented bar)
  - Damage type breakdown (stacked bar per character)
- All charts update live via WebSocket without page refresh

### Phase 6 — DM Corrections & Session End *(Target: Weekend 6)*
**Milestone: DM can edit entries; session ends cleanly with summary.**

- Backend: `event_corrections` table + migration
- Backend: `POST /events/:id/correct` — creates correction row, flags original, rebroadcasts
- Frontend: DM event feed — click any entry to open correction modal
- Frontend: Corrected events show original struck through with correction below; amber "corrected" badge
- Backend: `PATCH /sessions/:id/end` — freezes session, triggers final stats computation
- Frontend: End session confirmation in DM view
- Frontend: `/session/:code/summary` — final end-of-session stats screen

### Phase 7 — Campaign Stats & Polish *(Target: Weekend 7)*
**Milestone: Campaign-wide stats work; app is production-ready for game night.**

- Backend: `GET /campaigns/:id/stats` — aggregate across all sessions
- Frontend: Campaign stats page — totals per character across all sessions
- Frontend: Session history list on campaign page — click any past session to review summary
- Polish: Loading states, error toasts, empty states for all views
- Polish: Responsive layout audit — player-facing screens tested at 390px (phone), 768px (tablet), and 1280px (laptop)
- Polish: Game night startup UX — friendly loading screen while Docker stack warms up; LAN URL and mDNS hostname displayed on DM dashboard for easy sharing
- Final smoke test: Full game night simulation with all players

---

## 8. Project Folder Structure

```
dnd-tracker/
├── docker-compose.yml           # Defines db, backend, frontend services
├── .env                         # All environment variables (gitignored)
├── .env.example                 # Committed template with placeholder values
├── start-game-night.sh          # Auto-detects host IP, updates .env, starts stack
├── CONTEXT.md                   # This file — load at start of every Copilot session
├── backend/
│   ├── Dockerfile
│   ├── main.py                  # FastAPI app init, CORS, router registration
│   ├── routers/
│   │   ├── auth.py              # /auth/* endpoints
│   │   ├── campaigns.py         # /campaigns/* endpoints
│   │   ├── sessions.py          # /sessions/* endpoints
│   │   ├── events.py            # /events/* endpoints
│   │   ├── npcs.py              # /npcs/* and /encounters/:id/npcs endpoints
│   │   └── websocket.py         # WS endpoint + room manager
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── campaign.py
│   │   ├── character.py
│   │   ├── session.py
│   │   ├── encounter.py
│   │   ├── npc.py
│   │   ├── combat_event.py
│   │   ├── event_correction.py
│   │   ├── death_save.py
│   │   └── session_stats.py
│   ├── schemas/                 # Pydantic request/response schemas (mirror models/)
│   ├── db/
│   │   ├── database.py          # Async engine + session factory
│   │   └── alembic/             # Migrations
│   ├── services/
│   │   ├── stats.py             # Stat aggregation logic
│   │   ├── hp.py                # HP auto-update + clamping logic
│   │   ├── death_saves.py       # Death save auto-resolution logic
│   │   ├── broadcast.py         # WebSocket broadcast helpers + NPC selective notify
│   │   └── session_manager.py   # WebSocket room management (singleton ConnectionManager)
│   ├── utils/
│   │   ├── auth.py              # JWT encode/decode helpers
│   │   └── codes.py             # Session code generator (WOLF-7 format)
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   ├── vite.config.js           # host: '0.0.0.0' — binds to all network interfaces
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx             # React root, router setup
│       ├── App.jsx              # Top-level route definitions
│       ├── pages/               # One file per route/page
│       │   ├── LandingPage.jsx
│       │   ├── DmLoginPage.jsx
│       │   ├── DmDashboardPage.jsx
│       │   ├── CampaignPage.jsx
│       │   ├── SessionPage.jsx  # Role-detects DM vs player, renders correct layout
│       │   ├── ScoreboardPage.jsx
│       │   └── SummaryPage.jsx
│       ├── components/
│       │   ├── dm/
│       │   │   ├── EventFeed.jsx
│       │   │   ├── InitiativeTracker.jsx
│       │   │   ├── NpcPanel.jsx          # NPC roster + expanded action form
│       │   │   ├── NpcCard.jsx           # Single collapsible NPC card
│       │   │   ├── NpcActionForm.jsx     # Five-tab form for NPC actions (amber theme)
│       │   │   ├── StatsStrip.jsx
│       │   │   └── CorrectionModal.jsx
│       │   ├── player/
│       │   │   ├── CharacterCard.jsx
│       │   │   ├── ActionForm.jsx        # Five-tab form for player actions (purple theme)
│       │   │   ├── BaseActionForm.jsx    # Shared form logic — color theme prop
│       │   │   ├── IncomingDamageToast.jsx
│       │   │   ├── PersonalStats.jsx
│       │   │   └── GroupMeter.jsx
│       │   └── charts/
│       │       ├── DamageMeter.jsx
│       │       ├── HealingChart.jsx
│       │       ├── KillLeaderboard.jsx
│       │       ├── AccuracyChart.jsx
│       │       ├── SpellSchoolBar.jsx
│       │       └── DamageTypeChart.jsx
│       ├── store/               # Zustand stores
│       │   ├── authStore.js     # JWT, user role, login/logout
│       │   ├── sessionStore.js  # Active session state, encounter, round
│       │   ├── eventsStore.js   # Combat event log, stats rollup
│       │   └── npcStore.js      # NPC roster, HP tracking, selected NPC
│       ├── services/
│       │   ├── api.js           # Axios instance + interceptors
│       │   └── websocket.js     # WS client + reconnect logic + message routing
│       └── router/
│           └── index.jsx        # React Router v6 routes + auth guards
└── README.md                    # Game night startup instructions
```

---

## 9. Game Night Startup Ritual

One command. Run on the DM's laptop before the session:

```bash
./start-game-night.sh
```

This script auto-detects the host laptop's local IP, writes it to `.env`, and runs `docker-compose up`. Players connect to the URL the script prints at the end.

**What the script does:**

```bash
#!/bin/bash
# start-game-night.sh

# Auto-detect local IP — works on Mac and Linux without hardcoding an interface name
HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1); exit}')
# Fallback for Mac if ip route is unavailable
if [ -z "$HOST_IP" ]; then
  HOST_IP=$(ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$HOST_IP" ]; then
  echo "ERROR: Could not detect local IP. Connect to WiFi and try again."
  exit 1
fi

# Write to .env (compatible sed syntax for Mac and Linux)
sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=http://$HOST_IP:8000|" .env
sed -i.bak "s|VITE_WS_URL=.*|VITE_WS_URL=ws://$HOST_IP:8000|" .env

echo "Starting stack..."
docker-compose up -d

echo ""
echo "✅ Stack is up. Players connect to:"
echo "   http://$HOST_IP:5173"
echo "   (or: http://$(hostname).local:5173 if mDNS works on your network)"
```

**mDNS alternative (Mac — preferred):**
On most home networks, players can use `http://your-macbook-name.local:5173` — this never changes regardless of whose house you're at and requires no IP lookup.

**To shut down after the session:**

```bash
docker-compose down    # stops containers but preserves data volume
```

> **Warning**: Never run `docker-compose down -v` unless intentionally wiping all campaign data. The `-v` flag deletes the named volume.

---

## 10. Key Decisions & Constraints

### Deliberate Decisions

- `combat_events` is append-only — corrections never delete rows, preserving full audit trail
- `actor_type` field on `combat_events` distinguishes player-logged vs DM-logged NPC actions
- NPC actions use selective WebSocket broadcast — players only see damage directed at them, never NPC HP or stats
- `session_stats` is a computed rollup, not source of truth — always derivable from `combat_events`
- WebSocket room state is backed by DB — reconnection restores full state, no data lost on drop
- Players need no account — session code + character name is sufficient for v1
- Session codes are human-readable (`WOLF-7` format) — easy to read aloud at the table
- NPC action form uses amber color theme; player action form uses purple — visually distinct at a glance
- No hard cap on player count — initiative tracker and damage meter scroll vertically when the list compacts
- Initiative is hybrid: players submit their own rolls on their phones; DM sets NPC values and retains full reorder control at all times
- Friendly fire toggle on Attack tab defaults off (NPC targets only); toggling on expands target dropdown to include player characters; `is_friendly_fire` flag set in DB; resets after each submission
- Healing always targets players freely — no toggle needed; healed player receives a phone notification
- Friendly fire events flagged with coral `FF Hit` / `FF Miss` badge in DM event feed
- HP auto-decrements/increments server-side on every damage/heal event; DM can manually override via inline edit for both characters and NPCs; HP clamped to 0–max_hp server-side
- Session codes use DB uniqueness constraint; collision returns 409 with a user-facing retry prompt — no silent retry
- Character `current_hp` persists between sessions — new session initializes from last session's ending HP; new characters start at `max_hp`
- AoE spells stored as single event with comma-separated `target_npc_ids` / `target_character_ids`; `damage_amount` is total rolled, not per-target
- Scoreboard is publicly accessible by URL; DM can also push all players to it via WebSocket `redirect` message
- Death saves auto-resolve on third success (stable) or third failure (dead) with broadcast; DM can override status at any time
- Multiple encounters supported per session; per-encounter stats available via dedicated endpoint; scoreboard has session/encounter toggle; end-of-session summary shows encounter timeline
- Cloud migration path is intentionally simple — swap Docker Postgres for Neon, deploy containers to Render, deploy React build to Netlify; no code changes, only environment variables and CORS origin update

### Known Constraints (Local WiFi Stack)

- All players must be on the same WiFi network as the host laptop — no internet required
- Host IP changes per location; `start-game-night.sh` handles this automatically; mDNS hostname is the zero-config alternative
- All data lives on the DM's laptop — regular backups of the Docker volume are recommended
- DM's laptop must stay awake and connected to WiFi for the duration of the session
- No HTTPS on local WiFi — connections are plain HTTP/WS; acceptable for a LAN game night app

### Out of Scope for v1

- Character sheet management (HP tracked but full 5e stat blocks are not stored)
- Dice rolling within the app (players roll physical dice; they enter results)
- Map / grid integration
- Push notifications or mobile app packaging
- Cloud hosting (planned for v2 if interest grows)

---

## 11. Notes for Copilot / AI Assistant

- The stack runs entirely in Docker Compose — never assume a cloud host or external DB URL
- `DATABASE_URL` in `.env` points to the Docker Postgres service name: `postgresql+asyncpg://dnduser:dndpass@db:5432/dndtracker`
- `VITE_API_URL` and `VITE_WS_URL` in `.env` are set to the host laptop's local IP by `start-game-night.sh` — never hardcode `localhost` in frontend code; always read from `import.meta.env.VITE_API_URL`
- `vite.config.js` must have `server: { host: '0.0.0.0' }` — this is what makes the frontend reachable from other devices on the LAN
- FastAPI must run with `--host 0.0.0.0` in the Dockerfile CMD — same reason
- Always use `async/await` in FastAPI route functions — never synchronous DB calls
- All DB access goes through SQLAlchemy sessions injected via FastAPI `Depends()`
- Pydantic schemas are separate from SQLAlchemy models — never expose ORM models directly in responses
- JWT validation is a FastAPI dependency — inject `get_current_user` or `get_current_dm` as needed; JWT encode/decode uses `PyJWT` (`import jwt`) — call `jwt.encode(payload, SECRET_KEY, algorithm="HS256")` to sign and `jwt.decode(token, SECRET_KEY, algorithms=["HS256"])` to verify; never use `python-jose`
- WebSocket room state lives in a singleton `ConnectionManager` class in `services/session_manager.py`
- NPC broadcast logic lives in `services/broadcast.py` — use `broadcast_to_room()` for all-player events and `notify_player()` for targeted NPC damage notifications
- All timestamps stored as UTC in DB; frontend converts to local time for display
- Use UUIDs for all primary keys — never auto-increment integers
- Alembic migration required for every schema change — never alter tables manually
- React components follow single-responsibility — one component per logical UI unit
- All server state lives in Zustand stores (`store/`) — components never call the API directly; always go through the store action
- `NpcActionForm.jsx` and `ActionForm.jsx` share logic via `BaseActionForm.jsx` — pass a `theme` prop (`'purple'` for players, `'amber'` for NPCs)
- Friendly fire toggle is local component state (`useState`) — reset to `false` in the submit handler after `POST /events` succeeds
- `is_friendly_fire` is set server-side in `events.py` by checking if `target_character_id` is non-null and `actor_type == 'player'` — do not rely solely on the client to set this flag
- Initiative submission flow uses a separate `POST /encounters/:id/initiative` endpoint, not `POST /events` — initiative rolls are not combat events and should not appear in the event feed
- The DM initiative tracker receives player roll submissions via WebSocket broadcast (`initiative_update` message type) so the order updates in real time without polling
- Initiative tracker rows use a drag-and-drop library (e.g. `@dnd-kit/sortable`) — DM reorder calls `PATCH /encounters/:id/initiative-order` with the new sorted array of character/NPC ids
- HP auto-update logic lives in `services/hp.py` — called from `events.py` after every `POST /events`; clamps to 0–`max_hp`; updates both `characters.current_hp` and `npcs.current_hp` depending on target type
- Session code generation in `utils/codes.py` retries up to 5 times on DB uniqueness violation before returning a 409 to the client — do not silently swallow the error
- AoE events use comma-separated UUID strings in `target_npc_ids` / `target_character_ids` — parse these as `str.split(',')` in the stats aggregation service; never store as a Postgres array type
- Death save resolution logic lives in `services/death_saves.py` — called after every death save event; auto-sets `characters.status` to `'stable'` or `'dead'` and broadcasts the outcome; DM override goes through `PATCH /characters/:id`
- `characters.status` valid values: `'active'` | `'unconscious'` | `'stable'` | `'dead'`
- Per-encounter stats endpoint `GET /encounters/:id/stats` returns the same shape as `GET /sessions/:id/stats` — reuse the same Pydantic response schema with an optional `encounter_id` filter in the aggregation query
- Scoreboard push is a WebSocket broadcast of `{"type": "redirect", "url": "/session/{code}/scoreboard"}` — frontend `websocket.js` handles `redirect` message type and calls React Router's `navigate(url)`
- React Router v6 is used for routing — use `useNavigate()` hook for programmatic navigation, `<Navigate>` for redirect components; no Vue Router concepts apply
