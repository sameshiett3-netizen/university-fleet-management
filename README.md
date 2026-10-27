<p align="center"><img src="frontend/public/abu-logo.png" alt="Ahmadu Bello University logo" width="110" /></p>

# University Fleet Management System

A web-based platform for the Ahmadu Bello University (ABU), Zaria motor pool. It digitizes vehicle dispatch,
shows active trips on a live map, and applies odometer-based **predictive maintenance** so that vehicles are
flagged for service before they fail.

- **Administrators** manage vehicles, drivers and trips, watch the live map, and log services.
- **Drivers** use a mobile-friendly portal to start trips and submit the final odometer reading.
- **A GPS simulator** stands in for tracking hardware and streams coordinates to the API.

## Architecture

```
React (Vite)  <--HTTP/JSON (cookie auth)-->  Node.js + Express  <--SQL-->  MySQL / MariaDB
     ^                                              |
     +-------- Socket.io (admins only) <------------+  <-- GPS simulator posts coordinates (secret)
```

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Leaflet + OpenStreetMap, Socket.io client, Axios |
| Backend | Node.js, Express 5, Socket.io, mysql2, bcrypt, JSON Web Tokens (HttpOnly cookie), helmet |
| Database | MySQL 8 / MariaDB 10.5+ (6 tables, foreign keys, CHECK constraints, transactions) |

Key rules implemented:

- **Trip lifecycle:** Pending → Approved → Active → Completed, with Cancelled from Pending/Approved and an administrator
  abort for Active trips. Availability is re-checked at approval and start, using row locks.
- **Atomic completion:** the trip, vehicle odometer, vehicle status and maintenance evaluation commit together in one
  SQL transaction. A *mileage integrity lock* rejects a final odometer below the start or current reading.
- **Predictive maintenance:** `Next_Service_Due = baseline + service_interval_km`, where the baseline is the latest
  service record's odometer (or the initial odometer). **Warning** at 90% of the interval, **Overdue** at 100%. A
  vehicle has at most one Active alert; it escalates automatically and resolves when a service is logged.
- **Security:** bcrypt password hashing, JWT in an HttpOnly cookie, role-based access on every route, CORS locked to the
  frontend origin, `X-Requested-With` header on state-changing requests, login rate limiting, authenticated WebSockets
  (administrators only) and a shared secret for the simulator.

## Quick start

Requirements: Node.js 20+, and a running MySQL 8 or MariaDB server (for example XAMPP).

```bash
# 1. Install everything
npm run install:all

# 2. Configure the backend
cp backend/.env.example backend/.env      # then edit DB_PORT, DB_PASSWORD and the two secrets

# 3. Create the database, the first administrator and (optionally) demo data
npm run db:init
npm run seed:admin
npm run seed:demo

# 4. Run the API and the web app (add the simulator with: npm run dev:all)
npm run dev
```

Open <http://localhost:5173> and sign in with the administrator from `backend/.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`). Demo drivers (after `seed:demo`) use the password `Driver@123`, for example
`musa.ibrahim@abu.edu.ng`.

> **Upgrading from the old prototype database?** The schema changed. Run `npm run db:reset` once (this deletes all
> existing data), then seed again. `db:init` refuses to build on top of the old schema.
>
> **XAMPP / non-default MySQL port?** Set `DB_PORT` (for example `3307`) in `backend/.env`.

### Demonstration walk-through

1. Sign in as the administrator, open **Trips**, and create a trip (vehicle, driver, destination). Approve it.
2. Sign in as that driver (second browser or phone) and press **Start trip**.
3. Run the simulator (`npm run simulator`, or `npm run dev:all`). The vehicle appears on **Live Tracking** and moves.
4. When it arrives, the driver presses **Complete trip** and enters the final odometer. Crossing 90% or 100% of the
   service interval raises a **Warning** or **Overdue** alert under **Maintenance**.
5. Log the service to reset the baseline and clear the alert.

The simulator uses the public OSRM routing service for road-following routes and falls back to a straight line when
offline. Map tiles need an internet connection.

## Project structure

```
database/schema.sql          Tables, constraints and indexes
backend/
  app.js, server.js, socket.js
  config/                    env, database pool, campus locations
  controllers/, routes/      auth, vehicles, drivers, trips, tracking, maintenance, dashboard
  middleware/                authentication, roles, CSRF header, error handling
  utils/                     validation, transactions, maintenance engine
  scripts/                   initDb, seedAdmin, seedDemo, gpsSimulator
  tests/                     automated tests (node:test + supertest)
frontend/src/
  pages/                     Login, Dashboard, LiveTracking, Trips, Vehicles, Drivers, Maintenance, DriverPortal
  components/, context/, api/, utils/
```

## API summary

All routes are under `/api`. State-changing requests need the `X-Requested-With: XMLHttpRequest` header.

| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` | Any |
| Vehicles | `GET/POST /vehicles`, `PUT/DELETE /vehicles/:id`, `PUT /vehicles/:id/status` | Admin |
| Drivers | `GET/POST /drivers`, `PUT/DELETE /drivers/:id` | Admin |
| Trips | `GET /trips`, `POST /trips`, `PUT /trips/:id/approve`, `/cancel`, `/terminate` | Admin |
| Trips | `GET /trips/my-trips`, `PUT /trips/:id/start`, `/complete` | Driver |
| Tracking | `POST /tracking/location`, `GET /tracking/simulator/trips` | Simulator secret |
| Tracking | `GET /tracking/active`, `GET /tracking/history/:id` | Admin |
| Maintenance | `GET /maintenance/alerts`, `GET /maintenance/service/:id`, `POST /maintenance/service` | Admin |
| Other | `GET /dashboard/summary` (Admin), `GET /locations` (any user), `GET /health` | |

Real-time events (Socket.io, administrators only): `vehicle_location_update`, `TRIP_STARTED`, `TRIP_COMPLETED`,
`TRIP_TERMINATED`.

## Testing

```bash
npm test          # backend: maintenance engine, API, authorization, concurrency, sockets
npm run lint      # frontend ESLint
npm run build     # frontend production build
```

The tests create and wipe a separate database named `fleet_test` using the `DB_*` settings, so they never touch `fleet_db`.

## Adding destinations

Campus destinations and their coordinates live in `backend/config/locations.js`. Add `'Place name': { lat, lng }` and
restart the API; the dispatch form and the simulator pick it up.

## Deployment notes

- Set `NODE_ENV=production`, strong `JWT_SECRET` and `SIMULATOR_SECRET`, and serve both apps over HTTPS.
- If the frontend and API are on different sites, set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`, and set
  `CLIENT_ORIGIN` to the exact frontend origin. Build the frontend with `VITE_API_URL` pointing at the API.
- Remove demo data and change all seeded passwords before real use.
