# Travel Together
**Find people. Share journeys. Create memories.**

A full-stack travel social platform: discover trips on a real map, find compatible travel partners, chat (text, images, files, voice notes), make WebRTC voice/video calls, plan itineraries, split expenses, and stay safe with blocking, reporting and an admin console.

## Tech stack
| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, React Router, Tailwind CSS, Lucide, Axios, React Hook Form + Zod, React-Leaflet (+ marker clustering), Socket.IO client |
| Backend | Node.js, Express 4, Socket.IO, Mongoose, JWT, bcryptjs, Zod, Multer, Helmet, rate limiting |
| Database | MongoDB (Atlas compatible) |
| Maps | Leaflet + OpenStreetMap tiles, Nominatim geocoding, OSRM routing (both proxied through the backend) |
| Weather | Open-Meteo (real data, no key) |
| Media | Cloudinary when configured, otherwise local disk (development only) |
| Realtime | Socket.IO (chat, presence, typing, receipts, call signaling); WebRTC for audio/video |

## Folder structure
```
travel-together/
├─ server/
│  ├─ config/        env + db
│  ├─ models/        User, Trip, misc.js (TripMember, JoinRequest, Invitation, Conversation, Message, Notification, Review, Connection, Favorite, Report, Expense, Call)
│  ├─ routes/        auth, users, trips, chat, social (connections/invitations/notifications/reports/calls), discover (geo/weather/destinations), admin
│  ├─ middleware/    auth (JWT + roles), error, security (NoSQL sanitizer), upload
│  ├─ services/      chat, trips, notify, storage, realtime, mail
│  ├─ utils/         matching, balances, geo, destinations, helpers
│  ├─ socket.js      authenticated Socket.IO + WebRTC signaling
│  ├─ seed.js        demo data      tests/   logic + no-DB HTTP smoke tests
└─ client/src/       components, pages, context, hooks, services, utils
```
(Controllers are colocated with routes to keep each resource in one file.)

## Quick start
Requirements: Node 18+ and a MongoDB (local or Atlas).
```bash
# 1. install
npm run install:all

# 2. configure the server
cp server/.env.example server/.env      # then edit MONGO_URI and JWT_SECRET

# 3. seed demo data (wipes the collections it seeds)
npm run seed

# 4. run (two terminals)
npm run dev:server     # API + Socket.IO on http://localhost:5000
npm run dev:client     # app on http://localhost:5173
```
Per package: `cd server && npm install && npm run dev | npm start | npm run seed`; `cd client && npm install && npm run dev | npm run build`.

### MongoDB setup
* **Local:** install MongoDB Community, then `MONGO_URI=mongodb://127.0.0.1:27017/travel-together`.
* **Atlas:** create a free cluster, add a database user, allow your IP (or 0.0.0.0/0 for hosted backends), copy the `mongodb+srv://…` string into `MONGO_URI`.

### Environment variables (`server/.env`)
| Var | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | long random string used to sign tokens |
| `PORT`, `SERVER_URL` | no | default 5000 / `http://localhost:5000` (used to build local upload URLs) |
| `CLIENT_URL` | yes in prod | allowed CORS origin(s), comma separated |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | prod | image, voice and file storage. Without them uploads are written to `server/uploads` (not durable on most hosts) |
| `CONTACT_EMAIL` | yes | your email, sent to OpenStreetMap geocoding as required by their usage policy |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | optional | background push. Generate once: `cd server && npx web-push generate-vapid-keys` |
| `TURN_URLS` + `TURN_SECRET` (or `TURN_USERNAME`/`TURN_CREDENTIAL`) | optional | TURN relay so calls connect on strict networks |
| `BREVO_API_KEY` | prod | send email over HTTPS (works where SMTP is blocked) |
| `SMTP_URL`, `MAIL_FROM` | optional | password-reset email. Without SMTP the reset link is **printed to the server console** |
| `TURN_URL/USERNAME/CREDENTIAL` | optional | TURN relay for calls across strict NATs (STUN only by default) |

Client (`client/.env`): `VITE_API_URL` (empty in dev; backend URL in production). No map API key is needed.

## Demo accounts (seed data)
| Role | Email | Password |
|---|---|---|
| Demo user | `demo@traveltogether.com` | `Demo@12345` |
| Admin | `admin@traveltogether.com` | `Admin@12345` |

Other seeded users use password `Travel@123`. **Delete or change these before any public deployment.**

## Features implemented
Auth (register/login/logout, JWT, bcrypt, forgot/reset password, email verification, logout-all-sessions, protected routes + server-side role checks) · profiles with completion %, privacy and notification settings · landing, dashboard (rule-based recommendations, upcoming, popular, travelers, saved, messages, notifications) · Explore with backend search/filters/sort/pagination, list + map views, clustering, "near me" via browser geolocation (asked only on click, approximate, never stored) · trip create/edit/cancel/delete, location picker with real Nominatim geocoding and reverse-geocoding on map click · open-join and request-to-join flows, leave, remove member, atomic capacity checks · itinerary builder and timeline, numbered itinerary map with real OSRM routes · private chat and group chat over Socket.IO (receipts, typing, presence, replies, reactions, pinning, delete, search, images, files, emoji, voice notes with waveform) · WebRTC voice and video calls with call history · connections, travel network, trip invitations from chat · traveler discovery with transparent compatibility scores · notifications center · favorites · reviews (only after a trip ends, one per user) · shared checklist · expense splitting with settle-up suggestions · live weather · destination pages · block, restrict, report, safety center · admin dashboard (stats, users, suspend, trips, reports, activity) · light/dark/system theme saved per account · responsive layout with mobile bottom nav and FAB.

Also included: email change with password check and confirmation link, background push notifications (Web Push + service worker, works with the tab closed on HTTPS/localhost), TURN support with short-lived credentials, global search (trips and travelers), trip ownership transfer, admin-managed trip categories, members-only trip photo gallery, private per-member trip notes (hotel, transport, emergency contacts; visible only to the author), "show past trips" filter, and desktop alerts while the site is open in a background tab.

## API overview
`/api/auth` register, login, me, logout, forgot-password, reset-password · `/api/users` profile, password, search, favorites, blocked, :id/block|restrict, by-username/:u, :id · `/api/trips` list (search/filters/`lat,lng,radius`/`all=true`), recommended, popular, mine, CRUD, `:id/join|leave|request|members|favorite|reviews|checklist|expenses|invite|cancel`, `:id/requests/:reqId/accept|reject` · `/api/conversations` list, private/:userId, :id, :id/messages, :id/read · `/api/messages/:id` delete, react, pin · `/api/uploads/:kind` (image|voice|file) · `/api/connections` · `/api/invitations/:id/accept|decline` · `/api/notifications` · `/api/reports` · `/api/calls` · `/api/geo/search|reverse|route` · `/api/weather` · `/api/destinations` · `/api/admin/*`.
Errors always look like `{ "success": false, "message": "…" }` (with `errors` for field validation).

Socket events: `message:send|receive|read|delete|update|delivered`, `typing:start|stop|update`, `user:online|offline`, `call:offer|incoming|answer|answered|reject|end|ended|ice-candidate`, `notification:new`. The socket identity is taken from the verified JWT, never from client input.

## Push and TURN setup
* **Push:** generate VAPID keys (command above), put them in `server/.env`, restart, then Settings → Notifications → *Enable push* → *Send test*. Browsers require HTTPS (localhost is allowed). Push is skipped while you have the site open and online, because the in-tab alert already shows it.
* **TURN:** calls use free Google STUN by default, which works on most home networks. Add a TURN server for mobile data/office networks: either a hosted provider (set `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`) or your own coturn with `use-auth-secret` and the same value in `TURN_SECRET` (the API then issues 6-hour credentials per call via `/api/calls/ice`).

## Deployment (recommended: one Render service + Atlas + Cloudinary + Brevo)
Express serves the built React app, the API and Socket.IO from a single URL, so there is no CORS setup and no `VITE_API_URL`.
1. **Atlas:** use a separate database name for production (e.g. `.../travel-together-prod`) so demo data stays out. Network Access must allow `0.0.0.0/0` (Render has no fixed IP).
2. **Render:** New → Blueprint → select this repo (`render.yaml`), or create a Web Service with build `npm install --prefix server && npm install --include=dev --prefix client && npm run build --prefix client`, start `npm start --prefix server`, health check `/api/health`.
3. **Environment variables:** `NODE_ENV=production`, `NODE_VERSION=22`, `MONGO_URI`, `JWT_SECRET`, `CONTACT_EMAIL`, and after the first deploy `CLIENT_URL` and `SERVER_URL` = your `https://<name>.onrender.com` (then redeploy). Add Cloudinary (`CLOUDINARY_*`), `BREVO_API_KEY` + `MAIL_FROM`, optional `VAPID_*` and `TURN_*`.
4. **First admin:** register on the live site, then in Atlas (Browse Collections → `users`) set that user's `role` to `admin`, or run locally against the production URI: `npm run make-admin -- you@example.com`.
5. **Free plan caveats:** the service sleeps after about 15 minutes idle (first request is slow, sockets reconnect), and outbound SMTP is blocked, which is why email uses the Brevo HTTPS API. Local-disk uploads vanish on restart, so Cloudinary is required.
6. **Alternative split deploy:** frontend on Vercel (`vercel.json`, `VITE_API_URL=https://your-api`) and backend on any Node host with WebSocket support; set `CLIENT_URL` to the Vercel URL.
* **Calls:** WebRTC requires HTTPS (Render provides it). Add TURN for mobile or office networks.

## Testing status (please read)
This project was built in a sandbox **without a MongoDB server or two-browser access**, so these were verified:
* `npm run build` (client) succeeds.
* `cd server && npm test`: unit tests for compatibility scoring, recommendations, expense balances and geo math; a no-DB HTTP smoke test (validation errors, NoSQL-operator rejection, 401s on protected and admin routes, error format); Mongoose schema validation; all server modules import cleanly.

**Not yet verified end-to-end. Run this checklist on your machine after seeding:** register → login → dashboard → search/filter → open trip → join (check `tripmembers` in MongoDB) → group chat → create trip with "Manali" (check `latitude/longitude` saved) → edit, save, leave → profile update → logout/login → request-to-join accept/reject → two browsers: private chat, typing, read receipts, voice note, voice call accept/decline/mute/end, video call → block then message (must fail) → report → admin login, suspend, resolve report → full trip shows "Trip Full" → map zoom/pan/cluster/popups, geolocation allow and deny, invalid location search → phone-width layout. Expect to fix small integration bugs the first time; none of the live-database, Socket.IO, WebRTC, Nominatim/OSRM, Cloudinary or deployment paths have been exercised here.

## Known gaps
Multi-device call ringing, live location sharing (skipped on purpose for privacy), and SSR/pre-rendered SEO (meta tags are set client-side) are not implemented. Verification and password-reset emails are only delivered once `SMTP_URL` is set; otherwise links print in the server console. Privacy/Terms/About pages are placeholder templates. OSM tile/Nominatim/OSRM public servers have usage policies; use a commercial provider for production traffic.
