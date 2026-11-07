
# ServiceHive

ServiceHive is a freelance marketplace web app that connects clients and freelancers. It includes a React client (Vite), an Express server, and MongoDB for persistence. The project implements authentication, project posting, bidding, email workflows, OTP, and Server-Sent Events for realtime updates.

**Tech Stack:**
- **Client:** React, Vite, Tailwind CSS
- **Server:** Node.js, Express
- **Database:** MongoDB (Mongoose models)
- **Email:** nodemailer (mailSender)

**Quick Start**
- **Clone:** git clone <repo-url>
- **Server:**
	- Install: `cd server && npm install`
	- Start: `npm run dev` (or `node index.js`)
- **Client:**
	- Install: `cd client && npm install`
	- Start: `npm run dev`

**Environment Examples**

Below are example environment files for local or production use. Never commit real secrets to version control — keep values in your local `server/.env` and `client/.env` files or a secure secrets manager.

- Client (`client/.env`):

```dotenv
VITE_API_URL=https://gigflow-node.onrender.com/api/v1
VITE_SOCKET_URL=https://gigflow-node.onrender.com
```

- Server (`server/.env`):

```dotenv
origin=https://gig-flow-mini-freelance-marketplace.vercel.app
port=5000
MONGODBURL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
MAIL_HOST=smtp.gmail.com
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_email_password
```

Notes:
- Replace `your_mongodb_connection_string`, `your_jwt_secret`, `your_email@gmail.com`, and `your_email_app_password` with real values stored securely.

**Project Structure (high level)**
- **server/**: Express app and API
	- `index.js` — server entry
	- `config/database.js` — DB connection
	- `controllers/` — request handlers (AuthController, ProjectController, BidController)
	- `routes/` — route definitions (AuthRoutes, ProjectRoutes, BidRoutes)
	- `models/` — Mongoose models (Client, Freelancer, Project, Bid, OTP, ForgotPassword)
	- `middlewares/` — AuthMiddleware, ServerSentUpdates
	- `mail/` — email templates
	- `utils/` — `mailSender.js`, `respond.js`
- **client/**: React (Vite) app
	- `src/components/` — UI components for client, freelancer, reusable pieces
	- `src/hooks/` — custom hooks (`useAuth.js`, `useBids.js`, `useGigs.js`)
	- `src/redux/` — store and slices
	- `src/services/api.js` — API helper

**API & Routes (overview)**
- `POST /auth/signup`, `POST /auth/login` — authentication
- `POST /projects` — create project (client)
- `GET /projects` — list/search projects
- `POST /projects/:id/bid` — place a bid (freelancer)
- Additional endpoints for OTP, password reset, and bid management follow controllers in `controllers/` and routes in `routes/`.


---





