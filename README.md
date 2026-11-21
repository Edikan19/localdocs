# LocalDocs

![CI](https://github.com/Edikan19/localdocs/actions/workflows/ci.yml/badge.svg)

A real-time collaborative rich-text editor for local networks, a small Google Docs built from scratch. Several people open the same document and edit it at the same time, with no internet needed.

<!-- TODO: add a demo GIF here: two browser windows side by side, typing in one and watching it appear in the other -->

## What works
- Real-time editing across browser tabs and devices on the same network
- Rich text (headings, lists, bold, italic) with per-user undo
- Live collaborator cursors with names, and an "N people editing" presence count
- Conflict-free merging, including two people typing at the same spot or editing while offline
- Documents saved to SQLite and restored on reload
- Live-synced document titles, and a dashboard to create, search and open documents
- Automatic reconnect with exponential backoff
- Server hardening: heartbeats that drop dead connections, a message size cap, and clean handling of a document deleted while open
- Unit and convergence tests, plus CI that lints, type-checks, tests and smoke-tests the Docker container

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

Open http://localhost:3000. The terminal also prints a Network URL; open it on other devices on the same Wi-Fi to edit together.

### Run with Docker
```bash
docker compose up --build
```
Then open http://localhost:3000. Data is stored in a Docker volume, so it survives restarts.

### Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Starts the app and the WebSocket server with `tsx server.ts` |
| `npm run build` | Builds the Next.js app |
| `npm start` | Runs the production server |
| `npm test` | Runs the Vitest suite |
| `npm run typecheck` | Generates Next.js route types and runs `tsc` |
| `npm run lint` | Runs ESLint |

## How it works
The browser holds a Yjs document and talks to a custom Node server (`server.ts`) over WebSockets at `/ws/<documentId>`. The server keeps one in-memory Yjs document per open document, relays updates and presence to everyone in that room, and saves the state to SQLite every couple of seconds, when the last person leaves, and on shutdown.

- **Document model:** the body is a Yjs XML fragment that TipTap edits; the title is a Yjs text. Both sync and persist through the same path.
- **Sync protocol:** written by hand on top of `y-protocols` (sync handshake, incremental updates, awareness for cursors and presence). Yjs handles the conflict-resolution algorithm.
- **Persistence:** the full Yjs state is stored as binary, with a plain-text copy for previews and search.
- **Offline:** the editor stays editable if the connection drops. On reconnect, the sync handshake