# Campus Bite

Campus Bite is a college canteen pre-order and token management app. Students browse the live menu, schedule pickup, receive a daily token, and track kitchen progress. Staff use a protected console to manage orders, inventory, offers, queue status, and sales.

## Stack

- React 18, Vite, React Router, Framer Motion, Recharts, and Lucide
- Node.js, Express, Mongoose, and MongoDB
- JWT bearer sessions with bcrypt password hashing and role checks

## Run locally

Requirements: Node.js 20 or newer and MongoDB 7 (local service or Docker).

1. Install dependencies from the project folder:

   ```powershell
   npm install
   npm install --prefix frontend
   npm install --prefix backend
   ```

2. Start MongoDB. With Docker Compose installed:

   ```powershell
   docker compose up -d mongo
   ```

   Or start a local MongoDB service listening on `127.0.0.1:27017`.

3. Copy `backend/.env.example` to `backend/.env` and replace `JWT_SECRET` with a long random value. The defaults target the local database and Vite development server. `frontend/.env.example` documents the optional API URL override.

4. Create the demo accounts, menu, offers, and initial order history:

   ```powershell
   npm run seed
   ```

5. Start both apps:

   ```powershell
   npm run dev
   ```

Open [http://localhost:5173](http://localhost:5173). The API listens on port 4000; `GET /api/health` reports its database connection.

To build and serve the frontend for production, run `npm run build`, then `npm run start` for the API. Serve `frontend/dist` from a static host and set `VITE_API_URL` at build time when the API is not on `http://localhost:4000/api`.

## Demo accounts

Seed data creates these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@campusbite.edu` | `password123` |
| Staff | `admin@campusbite.edu` | `admin123` |

Students can also register from the app. The seed script is safe to rerun for menu and account setup; it only creates demo orders and notifications when the database has no orders.

## Main flows

- **Student:** search, category, dietary, price and rating filters, sorting, food details, favorites, saved cart, pickup scheduling, regular or express pickup, offer codes, checkout, order cancellation before preparation, printable receipt, QR pickup pass, and live order timeline.
- **Staff:** live order list and queue, guarded order status transitions, menu editor, availability and stock controls, sales and peak-hour analytics, student summaries, notification inbox, offers, canteen hours, express pickup, service fee, and home-screen announcements.
- **Updates:** student data refreshes every 12 seconds, order detail every 8 seconds, and staff data every 10 seconds. This uses polling; it does not require a separate WebSocket service.
- **Tokens:** MongoDB atomically increments a counter keyed by the current India Standard Time date. Tokens have the form `B-001` and restart at `B-001` on a new canteen day.
- **Order lifecycle:** `placed → confirmed → preparing → ready → called → completed`. Staff can cancel orders before preparation; students can cancel their own orders while still placed or confirmed. Cancellation restores reserved stock.
- **Analytics:** revenue and top-selling dishes count completed pickups. Average preparation time is calculated from saved `preparing` and `ready` timestamps and stays blank until those transitions exist.
- **Pickup payment:** checkout records the order and payable amount; payment is collected at pickup. No payment gateway is configured.

## Data model

Mongoose models are in `backend/src/models/index.js`:

- `User`: role, login credentials, student details, and favorite menu item references
- `FoodItem`: pricing, category, dietary flag, stock, availability, preparation time, ratings, and search fields
- `Order`: immutable item/price snapshots, token/day key, pickup schedule, totals, status and status history
- `TokenCounter`: daily sequence used to allocate unique tokens
- `Notification`: student or staff updates with read state and optional order reference
- `Promotion`: checkout discount codes and activation dates
- `Setting`: canteen hours, open state, announcement, express option, and service fee

## API map

All routes are prefixed by `/api`.

- `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me`
- `GET /menu`; staff `POST/PATCH/DELETE /menu`
- `GET /favorites`, `POST /favorites/:foodId/toggle`
- `POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`
- `GET /queue`
- `GET /notifications`, `PATCH /notifications/read`, `DELETE /notifications/:id`
- `GET /settings`; staff `PATCH /settings`
- `GET /promotions`; staff `POST/PATCH/DELETE /promotions`
- Staff analytics and students: `GET /admin/analytics`, `GET /admin/students`
- `GET /health`

Authenticated calls use `Authorization: Bearer <token>`. Admin APIs require the `admin` role. Students may only read and cancel their own orders and delete their own notifications.

## Demo checklist

- [ ] Register a student, sign in, sign out, and confirm role protected routes.
- [ ] Search and filter the menu; sort by price, popularity, rating, and preparation time; open a food detail and favorite it.
- [ ] Add and remove items, update quantities, apply an offer, select pickup time and type, then place an order.
- [ ] Confirm the order is saved, the daily token is unique, and the student timeline and receipt show the saved order.
- [ ] Sign in as staff, move an order through its valid states, call its token, and complete pickup.
- [ ] Change menu availability and stock, create or pause an offer, review analytics, and remove a notification.
- [ ] Check the landing, student, and staff views at desktop, tablet, and mobile widths.

Run `npm run build` for the production frontend build. The browser UI was checked at desktop and mobile widths; end-to-end database flows require MongoDB to be running, followed by `npm run seed` and the demo accounts above.

## Project structure

```text
backend/
  src/server.js             Express API and route handlers
  src/middleware/auth.js    JWT and role checks
  src/models/index.js       Mongoose schemas
  src/scripts/seed.js       Demo accounts and canteen data
frontend/
  src/App.jsx               Public and protected routes
  src/Student.jsx           Student app and ordering flows
  src/Admin.jsx             Staff console and analytics
  src/styles.css            Responsive application styles
  src/api.js                API client and formatting helpers
```
