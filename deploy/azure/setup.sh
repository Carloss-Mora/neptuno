#!/usr/bin/env bash
# Instala Neptuno en una máquina virtual Ubuntu 22.04/24.04 de Azure (web + PocketBase + HTTPS con Caddy).
# Uso:  sudo bash setup.sh neptuno-demo.eastus.cloudapp.azure.com
set -euo pipefail

HOST="${1:?Indica la dirección pública, por ejemplo neptuno-demo.eastus.cloudapp.azure.com}"
APP=/opt/neptuno
DATA=/var/lib/neptuno
ENV_FILE=/etc/neptuno.env

apt-get update -y
apt-get install -y git curl unzip debian-keyring debian-archive-keyring apt-transport-https gpg
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

# Código
if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only; else git clone https://github.com/Carloss-Mora/neptuno "$APP"; fi
cd "$APP"
git checkout -- apps/web/dist 2>/dev/null || true

# Variables (se crean una sola vez; edítalas con: sudo nano /etc/neptuno.env)
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<ENVEOF
PB_ENCRYPTION_KEY=$(openssl rand -hex 16)
PUBLIC_APP_URL=https://$HOST
VITE_POCKETBASE_URL=https://$HOST
NODE_ENV=production
ENABLE_DEMO_USER=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SENDER_ADDRESS=
SMTP_SENDER_NAME=Neptuno
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEPTUNO_DEMO_PRELOAD_EMAILS=carloz1mora2005@gmail.com
ENVEOF
  chmod 600 "$ENV_FILE"
fi

# Web
set -a; . "$ENV_FILE"; set +a
npm ci --no-audit --no-fund
npm run build --prefix apps/web
node apps/pocketbase/install-pocketbase.cjs
mkdir -p "$DATA"

# PocketBase como servicio
cat > /etc/systemd/system/neptuno.service <<UNIT
[Unit]
Description=Neptuno (PocketBase)
After=network.target

[Service]
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP/apps/pocketbase
ExecStart=$APP/apps/pocketbase/pocketbase serve --http=127.0.0.1:8090 --dir=$DATA --hooksDir=$APP/apps/pocketbase/pb_hooks --migrationsDir=$APP/apps/pocketbase/pb_migrations --encryptionEnv=PB_ENCRYPTION_KEY
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sed "s/HOST/$HOST/" "$APP/deploy/azure/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now neptuno
systemctl restart caddy

echo
echo "Listo: https://$HOST"
echo "1) Crea el administrador (cambia correo y clave):"
echo "   sudo bash -c 'set -a; . $ENV_FILE; set +a; cd $APP/apps/pocketbase && ./pocketbase superuser upsert TU_CORREO TU_CLAVE --dir=$DATA --encryptionEnv=PB_ENCRYPTION_KEY'"
echo "2) Completa SMTP y Google en $ENV_FILE y reinicia:  sudo systemctl restart neptuno"
