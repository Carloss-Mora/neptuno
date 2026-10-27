#!/usr/bin/env bash
# Actualiza Neptuno en la máquina virtual: baja los cambios, recompila la web y reinicia.
# Uso:  sudo bash /opt/neptuno/deploy/azure/update.sh
set -euo pipefail
cd /opt/neptuno
set -a; . /etc/neptuno.env; set +a
git pull --ff-only
npm ci --include=dev --no-audit --no-fund
npm run build --prefix apps/web
sed "s/HOST/$(sed -n 's#^PUBLIC_APP_URL=https://##p' /etc/neptuno.env)/" deploy/azure/Caddyfile > /etc/caddy/Caddyfile
systemctl restart neptuno
systemctl restart caddy
echo "LISTO-ACTUALIZADO: $(git log --oneline -1)"
