# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (Next.js) — run from we-us/
npm run dev       # Start dev server on localhost:3000
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint

# Backend (Socket.IO server) — run from we-us/
node server.js    # Start Express/Socket.IO backend
```

The frontend expects the backend at `https://we-us-backend.onrender.com` (hardcoded in `app/page.tsx:12`). For local dev, change `SERVER_URL` in that file to `http://localhost:4000` (or whatever port `server.js` binds to).

Required env vars in `.env`:
- `GEMINI_API_KEY` — Google Gemini AI
- `MONGODB_URI` — MongoDB Atlas connection string

## Architecture

This is a **single-page real-time debate app** split into two processes:

### Frontend (`app/`)
- `app/page.tsx` is the **entire app router** — it manages one global `Socket` instance and a `step` state machine (`lobby → role_select → waiting → chat`, or `spectator_list → spectator_room`). All views are rendered conditionally in this one file.
- Bottom nav tabs (`LOBBY`, `RECORD`, `PROFILE`) are controlled by `activeTab` state and only show when `step === 'lobby'`.
- `userId` and `nickname` are persisted in `localStorage` (`weus_user_id`, `weus_nickname`) to prevent state loss during re-renders. There is no mandatory sign-in.
- All Socket.IO event listeners are registered in a single `useEffect` in `page.tsx` — adding new server events must be done there.

### Backend (`server.js`)
- Single Node.js file running Express + Socket.IO.
- Handles: matchmaking queue, room lifecycle, AI chat (Gemini), chemistry report generation, spectator pub/sub, lounge chat, faction score tracking, push token registry, and MongoDB persistence.
- MongoDB models: `User` (stats, persona, tier, push tokens, friends, blockedUsers), `DM` (1:1 messages), `Report` (per-debate report + stats), `Blacklist` (user reports).
- Rotating debate scenarios (`DAILY_EVENTS`) and current events are managed as in-memory constant objects, not database models.
- Gemini is called with a fallback chain: `gemma-3-12b → gemma-3-27b → gemma-3-4b`.
- Zombie room cleanup runs every 10 minutes; disconnection grace period is 10 seconds. Auto-mute (3s) triggers after 7 consecutive messages from a user.

### Component responsibilities
| Component | Role |
|---|---|
| `LobbyView` | Topic category grid, daily event banner, matchmaking entry |
| `ChatRoom` | 3-min debate UI: timer, messages, Cyrano AI panel, time-extension voting, AI report card |
| `SpectatorList` | Live room grid with spectator counts |
| `SpectatorRoom` | Read-only debate view with real-time faction vote bars |
| `ProfileView` | Nickname, tier, friends list, DM modal |
| `RecordView` | Cumulative stats (logic/linguistics/empathy), persona, conversation history |
| `LoungeRoom` | Global open chat room |

### Key patterns
- **State lives in `page.tsx`**, passed down as props — components are mostly presentational.
- **Role-based debate topics** use `ROLE_MAP` and `ROLE_MISSIONS` constants in `page.tsx` to assign named roles and secret missions to each player.
- **Spectator voting** uses optimistic UI in `SpectatorRoom`.
- **Report sharing** uses `html2canvas` to screenshot the report card for Instagram story export.
- The app is designed to be embedded in a React Native WebView (Expo): it listens for `expoPushToken` custom events and sends `SHOW_ADMOB_AD` messages via `ReactNativeWebView.postMessage`.

## Deployment
- Frontend → Vercel
- Backend → Render (always-on)
- Database → MongoDB Atlas
