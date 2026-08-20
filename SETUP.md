# Setup Guide: Render + Neon Database

## 1. Create a Neon database

1. Go to [neon.tech](https://neon.tech) and sign up (free tier).
2. Create a new project (e.g. `services-booking`). Pick a region close to you.
3. In the dashboard, open **Connection Details**.
4. Copy the **Pooled connection string** — it looks like:
   ```
   postgresql://neondb_owner:xxxxx@ep-xxxx.us-east-2.aws.neon.tech/services_booking?sslmode=require
   ```
   Keep this string handy — it's your `DATABASE_URL`.

## 2. Run locally (optional, for development)

1. Copy the example env file:
   ```
   cp .env.example .env
   ```
2. Edit `.env` and set:
   ```
   DATABASE_URL=postgresql://neondb_owner:xxxxx@ep-xxxx.us-east-2.aws.neon.tech/services_booking?sslmode=require
   DB_SSL=true
   ```
   (The code already auto-detects `DATABASE_URL` and enables SSL — no other DB settings needed.)
3. Start the server:
   ```
   npm install
   npm run dev
   ```
4. Verify: open `http://localhost:5000/api/health` → `{"status":"ok"}`

## 3. Deploy to Render (auto-deploy with render.yaml)

1. Push this repo to GitHub (already done: `mwemmz/services-booking-backend`).
2. On Render, click **New → Blueprint**.
3. Connect your GitHub account and select the repo.
4. Render will read `render.yaml`. For every variable marked `sync: false`, it will ask you to enter a value — paste the values below.
5. Deploy.

### Environment variable values to enter in Render

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string (from step 1) |
| `JWT_SECRET` | Any long random string |
| `JWT_REFRESH_SECRET` | Any long random string (different from above) |
| `CLOUDINARY_CLOUD_NAME` | From your Cloudinary dashboard (skip if not using uploads) |
| `CLOUDINARY_API_KEY` | From Cloudinary |
| `CLOUDINARY_API_SECRET` | From Cloudinary |
| `FIREBASE_PROJECT_ID` | From your Firebase project (skip for now if not set up) |
| `FIREBASE_PRIVATE_KEY` | From Firebase service account |
| `FIREBASE_CLIENT_EMAIL` | From Firebase service account |
| `GOOGLE_MAPS_API_KEY` | From Google Cloud Console |
| `PAYMENT_API_URL` / `PAYMENT_API_KEY` / `PAYMENT_SECRET_KEY` / `PAYMENT_WEBHOOK_SECRET` | From your payment gateway |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email provider creds (for Nodemailer) |

**Tip:** You only *need* `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` to get the app running. Leave the rest blank and fill them in later.

## 4. Verify the deployment

- Render gives your app a public URL like `https://services-booking-backend.onrender.com`
- Open `https://services-booking-backend.onrender.com/api/health` → should return `{"status":"ok"}`
- Test registration:
  ```
  curl -X POST https://services-booking-backend.onrender.com/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@test.com","password":"password123"}'
  ```

## Notes

- **Neon + Sequelize:** the app already handles the `DATABASE_URL` and SSL automatically. If you ever switch back to a local PostgreSQL, just comment out `DATABASE_URL`/`DB_SSL` and use `DB_HOST`, `DB_USER`, etc.
- **Free tier limits:** Render's free web service sleeps after 15 min of inactivity — first request after a pause will be slow. Neon free tier pauses after 5 min idle (you can re-enable on demand).
- **Socket.IO:** Render supports WebSockets. In the app, connect to `wss://your-app.onrender.com` instead of `ws://`.
