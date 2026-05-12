# mypos

mypos is a lightweight point-of-sale application for internal outlet operations. It is built for a small team of cashiers and admins, with a React frontend, Express API, and MySQL database.

The recommended deployment path is Docker Compose. It runs the frontend, backend API, and MySQL database together, exposes only the web app on port 80, and keeps the API/database inside the Docker network.

## Features

- POS checkout with cash and QRIS payment methods
- Transaction history filtered by selected date from the database
- Daily sales summary for 30 days, 60 days, or a custom date range
- Product and category management
- User management for admin/cashier roles
- 58 mm thermal-printer-friendly receipt layout
- Default superadmin seeding for first setup
- Basic double-submit protection for transaction creation
- Backend health checks and database reconnect/bootstrap retry

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: MySQL 8
- Deployment: Docker Compose, Nginx

## Quick Start With Docker

Requirements:

- Docker
- Docker Compose

Create an environment file:

```bash
cp .env.docker.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env
```

Start the app:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost
```

On a server, open:

```text
http://SERVER_IP
```

Default login for a fresh database:

```text
Username: admin
Password: admin123
```

Important: the default admin user is created only when the `users` table is empty. If you already have an existing Docker volume/database, the password will not be reset automatically.

## Production Deployment

For a simple server deployment:

```bash
docker compose up -d --build
```

The default Docker setup publishes:

```text
web: http://SERVER_IP
```

The API and MySQL are not published to the public host. The frontend reaches the API through Nginx using `/api`.

If port 80 is already used by another service, edit `.env`:

```env
WEB_PORT=8080
```

Then access:

```text
http://SERVER_IP:8080
```

## Environment Variables

Copy `.env.docker.example` to `.env`, then adjust values as needed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | `mypos_root_password` | MySQL root password inside Docker |
| `DB_NAME` | `mypos` | Database name |
| `JWT_SECRET` | `change_this_for_production` | Token signing secret |
| `ADMIN_USERNAME` | `admin` | Default superadmin username for first setup |
| `ADMIN_PASSWORD` | `admin123` | Default superadmin password for first setup |
| `ADMIN_FULLNAME` | `Super Admin` | Default superadmin display name |
| `WEB_PORT` | `80` | Public web port |
| `FRONTEND_URL` | `http://localhost` | Frontend origin used by backend config |
| `CORS_ORIGIN` | localhost origins | Allowed browser origins for API requests |
| `VITE_API_BASE_URL` | empty | Keep empty for Docker Nginx `/api` proxy |

Recommended production changes:

```env
MYSQL_ROOT_PASSWORD=use_a_strong_password
JWT_SECRET=use_a_long_random_secret
FRONTEND_URL=http://your-server-ip-or-domain
CORS_ORIGIN=http://your-server-ip-or-domain
```

If you use the default same-origin Docker setup, `VITE_API_BASE_URL` should stay empty.

## Database Setup

You do not need to install MySQL manually when using Docker.

Docker Compose starts a MySQL 8 container and stores data in the `mysql_data` volume. The backend automatically:

- creates the database if it does not exist
- creates required tables if they do not exist
- creates useful indexes
- seeds the default superadmin if the users table is empty

Tables created by the app:

- `products`
- `transactions`
- `transaction_items`
- `transaction_idempotency_keys`
- `users`

## Useful Commands

Start or rebuild:

```bash
docker compose up -d --build
```

Check containers:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f mysql
```

Restart:

```bash
docker compose restart
```

Stop:

```bash
docker compose down
```

Stop and remove database data:

```bash
docker compose down -v
```

Use `down -v` carefully. It removes the MySQL volume and deletes POS data stored in that Docker volume.

## Health Checks

From the server:

```bash
curl http://localhost/api/health/live
curl http://localhost/api/health/ready
```

Expected:

- `/api/health/live`: app process is alive
- `/api/health/ready`: database connection and bootstrap are ready

If `live` works but `ready` fails, check MySQL logs:

```bash
docker compose logs -f mysql
docker compose logs -f api
```

## Local Development

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd server
npm install
```

Run frontend:

```bash
npm run dev
```

Run backend:

```bash
cd server
npm start
```

For non-Docker development, you need a reachable MySQL server and backend environment variables such as:

```env
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=mypos
JWT_SECRET=dev_secret_change_me
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_FULLNAME=Super Admin
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Frontend API config for local development:

```env
VITE_API_BASE_URL=http://localhost:4000
```

For Docker deployment, leave `VITE_API_BASE_URL` empty.

## Quality Checks

Run before deploying code changes:

```bash
npm run lint
npx tsc -b --noEmit
npm run build
```

Backend syntax check:

```powershell
Get-ChildItem -Path server -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Project Structure

```text
mypos/
  src/
    components/        frontend UI components
    contexts/          app state and auth/cart providers
    pages/             route-level screens
    services/          frontend API clients
    styles/            print and global styling
    types/             shared frontend TypeScript types
    utils/             formatting, printing, helpers

  server/
    server.js          API entrypoint
    src/
      app.js           Express app setup
      config/          env and CORS config
      controllers/     request handlers
      db/              pool, bootstrap, schema, db state
      middleware/      auth, error handling, db readiness
      routes/          API route definitions
      services/        database/business logic
      utils/           date and id helpers

  docker-compose.yml   production-oriented local stack
  Dockerfile           frontend build + Nginx image
  nginx.conf           frontend serving and /api proxy
```

## API Notes

Important routes:

```text
POST /api/auth/login
GET  /api/health/live
GET  /api/health/ready
GET  /api/products
GET  /api/transactions?date=YYYY-MM-DD
GET  /api/transactions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET  /api/transactions/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET  /api/transactions/stream
POST /api/transactions
```

History and Daily Summary are filtered at the database query level. The app does not fetch all transaction history and filter it on the frontend.

## Troubleshooting

Cannot open the app:

- Check `docker compose ps`
- Make sure the `web` service is healthy
- Make sure port `80` is not already used by another service
- If needed, set `WEB_PORT=8080` in `.env`

Login fails:

- For a fresh database, use `admin / admin123`
- If using an old Docker volume, the old user/password still applies
- Check API readiness: `curl http://localhost/api/health/ready`
- Check backend logs: `docker compose logs -f api`

Database is not ready:

- Check MySQL logs: `docker compose logs -f mysql`
- Confirm `MYSQL_ROOT_PASSWORD`, `DB_NAME`, and backend DB env values match
- Wait a few seconds after first startup; MySQL initialization can take time

Phone cannot access the app on LAN:

- Use `http://LAPTOP_OR_SERVER_IP`, not `localhost`
- Make sure phone and server are on the same network
- Make sure firewall allows the configured `WEB_PORT`
- Use the web port only; do not open the API port directly

Port 80 is busy:

```env
WEB_PORT=8080
```

Then:

```bash
docker compose up -d --build
```

Open:

```text
http://SERVER_IP:8080
```

## Deployment Checklist

Before using in production:

- Set a stronger `MYSQL_ROOT_PASSWORD`
- Set a stronger `JWT_SECRET`
- Confirm `WEB_PORT` is correct for the server
- Confirm firewall allows the web port
- Run `docker compose up -d --build`
- Confirm `docker compose ps` shows healthy services
- Test login
- Test creating one transaction
- Test History and Daily Summary
- Test printing a receipt on the target thermal printer

## Notes

- Receipt header is configured for `Warung Jepang Abusan`.
- Docker deployment is the recommended path.
- The legacy `deploy.sh` script is kept in the repository, but Docker Compose is simpler and less error-prone for this app.
