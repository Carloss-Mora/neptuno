#!/usr/bin/env bash
# Actualiza Neptuno en la máquina virtual: baja los cambios, recompila la web y reinicia.
# Uso:  sudo bash /opt/neptuno/deploy/azure/update.sh
set -euo pipefail
cd /opt/neptuno
ENV_FILE=/etc/neptuno.env

# Ajustes para una sala con mucha gente (se agregan una sola vez si faltan)
add_default() { grep -q "^$1=" "$ENV_FILE" || echo "$1=$2" >> "$ENV_FILE"; }
add_default NEPTUNO_TRUST_PROXY true
add_default NEPTUNO_RELAXED_LIMITS true
add_default NEPTUNO_DEMO_GUEST demo@neptuno.app:Neptuno-demo-2026

git fetch -q origin main
git reset -q --hard origin/main
set -a; . "$ENV_FILE"; set +a
npm ci --include=dev --no-audit --no-fund
npm run build --prefix apps/web
sed "s/HOST/$(sed -n 's#^PUBLIC_APP_URL=https://##p' "$ENV_FILE")/" deploy/azure/Caddyfile > /etc/caddy/Caddyfile
systemctl restart neptuno
systemctl restart caddy
echo "LISTO-ACTUALIZADO: $(git log --oneline -1)"
