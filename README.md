# LocalDocs

![CI](https://github.com/Edikan19/localdocs/actions/workflows/ci.yml/badge.svg)

A real-time collaborative rich-text editor, a small Google Docs built from scratch. Several people open the same document and edit it at the same time, with accounts, sharing and live cursors.

<!-- TODO: add a demo GIF here: two browser windows side by side, typing in one and watching it appear in the other -->

## What works
- Real-time editing across browser tabs and devices, with live collaborator cursors and names
- Rich text (headings, lists, bold, italic) with per-user undo
- Conflict-free merging, including two people typing at the same spot or editing while offline
- Accounts: sign-up and login, scrypt-hashed passwords, database-backed sessions in HttpOnly cookies
- Sharing: owners add people by email as editors or viewers; roles are enforced on the server
- Documents saved to SQLite and restored on reload; live-synced titles; a dashboard to create, search and open documents
- Automatic reconnect with exponential backoff
- Hardening: login required on WebSockets, origin checks, access re-checked every 30 seconds, heartbeats that drop dead connections, a message size cap, rate-limited sign-in, and a per-user document cap
- 43 unit and convergence tests, plus CI that lints, type-checks, tests and smoke-tests the Docker container

## Stack
Next.js (App Router) · TypeScript · TipTap · Yjs (CRDT) · WebSockets (`ws`) · Prisma + SQLite · Vitest · Docker · GitHub Actions

## Getting started
Requires Node.js 24 (what CI and Docker use).

```bash
npm install
cp .env.example .env
npx prisma migrate dev --config prisma7.config.ts
npm run dev
```

Open http://localhost:3000. You'll be asked to create an account. The first account also takes ownership of any documents that existed before accounts were added. The terminal prints a Network URL too, which other devices on the same Wi-Fi can use.

### Run with Docker
```bash
docker compose up --build
```
Then open http://localhost:3000. Data is stored in a Docker volume, so it survives restarts. The container runs in production mode, where login cookies are marked Secure. If you open it over plain `http://` from another device, set `COOKIE_SECURE=false` in the environment first.

### Configuration
| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite database location |
| `PORT` | `3000` | Port to listen on |
| `ALLOW_SIGNUP` | `true` | Set to `false` to close registration |
| `COOKIE_SECURE` | secure in production | Force the Secure flag on or off for the login cookie |
| `ALLOWED_ORIGINS` | *(empty)* | Extra origins allowed to open WebSockets, comma-separated. Same-host origins are always allowed |
| `MAX_DOCUMENTS` | `200` | Maximum documents each person can own |

### Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Starts the app and the WebSocket server with `tsx server.ts` |
| `npm run build` | Builds the Next.js app |
| `npm start` | Runs the production server (run `npm run build` first) |
| `npm test` | Runs the Vitest suite |
| `npm run typecheck` | Generates Next.js route types and runs `tsc` |
| `npm run lint` | Runs ESLint |

## How it works
The browser holds a Yjs document and talks to a custom Node server (`server.ts`) over WebSockets at `/ws/<documentId>`. The server keeps one in-memory Yjs document per open document, relays updates and presence to everyone in that room, and saves the state to SQLite every couple of seconds, when the last person leaves, and on shutdown.

- **Document model:** the body is a Yjs XML fragment that TipTap edits; the title is a Yjs text. Both sync and persist through the same path.
- **Sync protocol:** written by hand on top of `y-protocols` (sync handshake, incremental updates, awareness for cursors and presence). Yjs handles the conflict-resolution algorithm.
- **Persistence:** the full Yjs state is stored as binary, with a plain-text copy for previews and search.
- **Offline:** the editor stays editable if the connection drops. On reconnect, the sync handshake merges everyone's changes.

### Accounts and access control
- **Sessions:** a random token is stored in an HttpOnly, SameSite=Lax cookie, and only its SHA-256 hash is stored in the database, so a leaked database can't be replayed. Sessions last 30 days.
- **Passwords:** hashed with Node's built-in scrypt and a random salt. The cost parameters are stored with each hash, so they can be raised later without locking anyone out.
- **Roles:** every document has an owner, plus optional editors and viewers. Owners can share, remove people and delete; editors can edit; viewers can read.
- **WebSocket security:** the server checks the login cookie and the user's role before joining a room, rejects cross-origin connections, and drops any write from a viewer, whatever the browser sends. Every 30 seconds each open connection is re-checked, so removing someone or signing out takes effect shortly afterwards.
- **Route protection:** `proxy.ts` only redirects visitors without a login cookie to the login page. The real checks happen in the pages and API routes, so access never depends on the redirect layer alone.

## Project structure
```
server.ts                 custom Next.js + WebSocket server
proxy.ts                  redirects visitors without a login cookie to /login
app/
  page.tsx, dashboard.tsx the document list (server check + client UI)
  login/, signup/         auth pages
  documents/[id]/         the editor page and share dialog
  api/auth/               sign-up, login, logout, current user
  api/documents/          list, create, get, delete, and sharing (members)
  api/health/             health checks used by Docker and CI
lib/
  prisma.ts               database client
  auth/                   passwords, sessions, roles, access checks, rate limiting
  collab/
    rooms.ts              server: rooms, persistence, presence, permissions, heartbeat
    provider.ts           browser: WebSocket provider with sync and reconnect
    permissions.ts        tells document edits apart from read-only messages
    origin.ts             WebSocket origin check
    text-binding.ts       binds a Yjs text to an input element
    doc-text.ts           plain text <-> rich-text helpers
prisma/                   schema and migrations
```

## Design decisions
- **Yjs instead of hand-rolled Operational Transform.** Merging concurrent edits correctly is a hard problem with a lot of edge cases. A CRDT library gives guaranteed convergence, including for offline edits, so the effort goes into the server, protocol and persistence around it.
- **A custom server instead of serverless.** WebSocket connections are long-lived and rooms live in memory, so the app runs as a persistent Node process that serves both Next.js and the sync endpoint.
- **A hand-written sync layer on `y-protocols`.** It keeps full control over loading, saving, presence, permissions and cleanup, rather than hiding them inside a ready-made server.
- **Hand-written sessions instead of an auth library.** The needs are small, and it lets the WebSocket server read the same cookie and check the same database as the web routes. A library would be the usual choice for a larger product.
- **SQLite.** No setup for a self-hosted tool. The trade-off is a single server instance.
- **Title and body both live in Yjs.** There is one writer for document data, and renames show up live for everyone.
- **Throttled saves.** Saves happen at most every 2 seconds while typing, with a final save when the room empties, so the database isn't written on every keystroke.

## Known limitations
- No email verification or password reset.
- Sharing needs the other person to have an account already, and adding someone reveals whether an account exists for that address (only owners can do this).
- A single server instance only, because rooms and the sign-in rate limiter are held in memory and the database is a local SQLite file.
- No version history yet.
- "Recent" and "Shared with me" in the dashboard sidebar are placeholders; shared documents appear in the main list.

## Roadmap
- [x] Real-time sync and persistence
- [x] Document list and rename
- [x] Tests and CI
- [x] Rich text (TipTap) and live cursors
- [x] Heartbeats, size limits, Docker
- [x] Authentication and sharing
- [ ] Public deployment
- [ ] Version history
- [ ] Password reset and email verification

## License
MIT