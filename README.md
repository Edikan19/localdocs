# LocalDocs

![CI](https://github.com/Edikan19/localdocs/actions/workflows/ci.yml/badge.svg)

A real-time collaborative document editor for local networks, a small Google Docs built from scratch. Several people open the same document and edit it at the same time, with no internet needed.

> **Status: work in progress.** Real-time rich-text editing with live cursors works. Hardening and Docker are in progress.

## What works
- Real-time editing across browser tabs and devices on the same network
- Conflict-free merging (two people typing at the same spot, or editing offline)
- Documents saved to SQLite and restored on reload
- Live "N people editing" presence count
- Automatic reconnect with exponential backoff
- Rich text (headings, lists, bold, italic) with per-user undo
- Live collaborator cursors with names
- Live-synced document titles and a document dashboard

## Stack
Next.js (App Router) · TypeScript · Prisma + SQLite · WebSockets (`ws`) · Yjs (CRDT)

## Getting started
```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```
Open the printed Network URL on other devices on the same Wi-Fi.

## How it works
The browser holds a Yjs document and talks to a custom Node server (`server.ts`) over WebSockets at `/ws/<documentId>`. The server keeps one in-memory Yjs document per open document (`lib/collab/rooms.ts`), relays updates and presence to everyone in that room, and saves the state to SQLite every couple of seconds. The sync protocol layer is written by hand on top of `y-protocols`; Yjs handles the conflict-resolution algorithm.

## Roadmap
- [x] Real-time sync and persistence
- [x] Document list and rename
- [x] Tests and CI
- [x] Rich text (TipTap) and live cursors
- [ ] Heartbeats, size limits, Docker