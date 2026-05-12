#!/usr/bin/env bash
set -euo pipefail

echo "=============================="
echo " mypos One-Click Deploy "
echo "=============================="

APP_DIR="/root/mypos"
BACKEND_DIR="$APP_DIR/server"
FRONTEND_DIR="$APP_DIR"
NGINX_DIR="/var/www/mypos"
PM2_NAME="mypos-api"
PORT="4000"

echo ""
echo "[1/7] Freeing port $PORT if in use..."
PID=$(sudo lsof -t -i :"$PORT" || true)
if [ -n "${PID}" ]; then
  echo "Port $PORT is in use by PID(s): $PID"
  echo "Killing..."
  sudo kill -9 $PID || true
  echo "Port $PORT freed."
else
  echo "Port $PORT is already free."
fi

echo ""
echo "[2/7] (Optional) Pulling latest git changes if repo exists..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull
else
  echo "No git repo detected, skipping git pull."
fi

echo ""
echo "[3/7] Backend install & restart PM2..."
cd "$BACKEND_DIR"
npm install

# start if not exists, otherwise restart
if pm2 list | grep -q "$PM2_NAME"; then
  echo "Restarting PM2 app: $PM2_NAME"
  pm2 restart "$PM2_NAME"
else
  echo "Starting PM2 app: $PM2_NAME"
  pm2 start server.js --name "$PM2_NAME"
fi

pm2 save

echo ""
echo "[4/7] Frontend install (if needed) & build..."
cd "$FRONTEND_DIR"
npm install
npm run build

echo ""
echo "[5/7] Deploy frontend dist to Nginx folder..."
sudo mkdir -p "$NGINX_DIR"
sudo rm -rf "$NGINX_DIR"/*
sudo cp -r "$FRONTEND_DIR/dist"/* "$NGINX_DIR/"

echo ""
echo "[6/7] Restarting Nginx..."
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "[7/7] Final status:"
echo "PM2 status:"
pm2 list
echo ""
echo "Port check:"
sudo lsof -i :"$PORT" || echo "Port $PORT is free (should be used by backend now)."

echo ""
echo "✅ Deploy finished successfully!"
