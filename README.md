# mypos

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-5FA04E?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-API-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-ready-2496ED?logo=docker&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-web_proxy-009639?logo=nginx&logoColor=white)

mypos adalah aplikasi POS internal untuk outlet kecil. Stack production-nya sederhana: React frontend diserve oleh Nginx, Express API di belakang `/api`, dan MySQL 8 di Docker volume.

## Fitur Utama

- POS checkout cash dan QRIS.
- Riwayat transaksi dengan filter tanggal langsung dari query database.
- Reports: daily summary dan usage report bahan/resep.
- Dashboard operasional: total penjualan, total transaksi, total bill, item terjual, trend 31 hari/12 minggu/6 bulan, payment mix, dan produk teratas.
- Produk, kategori, user, bahan baku, harga bahan, dan resep produk.
- Struk 58 mm thermal-printer-friendly dengan header `Warung Jepang Abusan`.
- Default admin untuk first setup: `admin / admin123`.
- Idempotency key untuk mengurangi risiko double input transaksi.
- Health check dan retry bootstrap database.

## Quick Start Docker

Requirements: Docker dan Docker Compose.

```bash
cp .env.docker.example .env
docker compose up -d --build
```

Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env
docker compose up -d --build
```

Buka aplikasi:

```text
http://localhost
```

Di server:

```text
http://SERVER_IP
```

## Login Default

```text
Username: admin
Password: admin123
```

Default user hanya dibuat kalau tabel `users` masih kosong. Kalau database lama sudah punya user, password lama tetap dipakai dan tidak ditimpa.

## Update Deploy Di Server

Untuk update kode dari versi lama:

```bash
git pull
docker compose up -d --build
```

Data tidak akan terhapus selama kamu tidak menjalankan:

```bash
docker compose down -v
```

Docker menyimpan data MySQL di volume `mysql_data`. Backend hanya menjalankan `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX` bila belum ada, dan perubahan enum role user yang aman. Fitur usage report akan membuat tabel baru bila belum ada: `ingredients`, `ingredient_prices`, dan `product_recipes`. Tabel transaksi lama tidak dihapus.

Tetap disarankan ambil backup sekali sebelum deploy pertama ke server utama:

```bash
docker compose exec -T mysql sh -lc 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" mypos' > backup_mypos_$(date +%F_%H%M%S).sql
```

## Environment

Copy `.env.docker.example` ke `.env`, lalu sesuaikan:

| Variable | Fungsi |
| --- | --- |
| `MYSQL_ROOT_PASSWORD` | Password root MySQL di Docker |
| `DB_NAME` | Nama database, default `mypos` |
| `JWT_SECRET` | Secret token login |
| `ADMIN_USERNAME` | Username admin default saat DB kosong |
| `ADMIN_PASSWORD` | Password admin default saat DB kosong |
| `ADMIN_FULLNAME` | Nama admin default |
| `WEB_PORT` | Port publik web, default `80` |
| `FRONTEND_URL` | Origin frontend |
| `CORS_ORIGIN` | Origin yang boleh akses API |
| `VITE_API_BASE_URL` | Kosongkan untuk Docker Nginx `/api` proxy |

Production minimal:

```env
MYSQL_ROOT_PASSWORD=isi_password_kuat
JWT_SECRET=isi_random_secret_panjang
FRONTEND_URL=http://IP_ATAU_DOMAIN_SERVER
CORS_ORIGIN=http://IP_ATAU_DOMAIN_SERVER
VITE_API_BASE_URL=
WEB_PORT=80
```

Kalau port 80 sudah dipakai:

```env
WEB_PORT=8080
```

Lalu buka `http://SERVER_IP:8080`.

## Struktur Project

```text
mypos/
  src/
    components/      UI reusable
    contexts/        auth, cart, product state
    pages/           route-level pages
    services/        API client frontend
    styles/          print/global CSS
    types/           TypeScript app types
    utils/           formatter, print, helper

  server/
    server.js        API entrypoint
    src/
      app.js         Express app setup
      config/        env dan CORS
      controllers/   request handlers
      db/            pool, schema bootstrap, db state
      middleware/    auth, errors, db readiness
      routes/        API routes
      services/      database/business logic
      utils/         date/id helpers

  docker-compose.yml
  Dockerfile
  nginx.conf
```

## Database

Docker Compose otomatis menjalankan MySQL 8. Aplikasi membuat database dan tabel yang belum ada saat API start.

Tabel utama:

```text
products
transactions
transaction_items
transaction_idempotency_keys
ingredients
ingredient_prices
product_recipes
users
```

Query berat seperti History, Reports, Usage Report, dan Dashboard difilter/diagregasi di backend database, bukan menarik semua transaksi ke frontend.

## Command Penting

```bash
docker compose up -d --build     # build dan start
docker compose ps                # cek status container
docker compose logs -f api       # log backend
docker compose logs -f web       # log nginx/frontend
docker compose logs -f mysql     # log mysql
docker compose restart           # restart semua service
docker compose down              # stop tanpa hapus data
```

Jangan pakai `docker compose down -v` kecuali memang ingin menghapus database volume.

## Health Check

```bash
curl http://localhost/api/health/live
curl http://localhost/api/health/ready
```

`live` berarti API process hidup. `ready` berarti API sudah berhasil konek dan bootstrap database.

## Quality Check

Sebelum deploy perubahan kode:

```bash
npm run lint
npx tsc -b --noEmit
npm run build
```

Backend syntax check:

```powershell
Get-ChildItem -Path server -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## API Ringkas

```text
POST /api/auth/login
GET  /api/health/live
GET  /api/health/ready
GET  /api/products
GET  /api/transactions?date=YYYY-MM-DD
GET  /api/transactions/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET  /api/reports/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET  /api/reports/recipe-usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET  /api/transactions/stream
POST /api/transactions
```

## Troubleshooting

Login gagal: cek `docker compose ps`, buka `http://SERVER_IP/api/health/ready`, lalu lihat `docker compose logs -f api`. Kalau database lama sudah punya user, gunakan user lama karena default admin tidak akan menimpa.

Tidak bisa dari HP: gunakan `http://IP_LAN_SERVER`, pastikan HP dan server satu jaringan, firewall membuka `WEB_PORT`, dan jangan pakai `localhost` dari HP.

Database belum ready: tunggu beberapa detik saat first startup, lalu cek `docker compose logs -f mysql` dan `docker compose logs -f api`.

Port 80 bentrok: set `WEB_PORT=8080`, jalankan ulang `docker compose up -d --build`, buka `http://SERVER_IP:8080`.

## Deployment Checklist

- Set `.env` production minimal.
- Jalankan backup satu kali sebelum update server utama.
- `git pull`
- `docker compose up -d --build`
- Pastikan `docker compose ps` healthy.
- Test login, buat satu transaksi, buka History, Reports, Dashboard, dan print struk.
