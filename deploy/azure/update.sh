#!/usr/bin/env bash
# Actualiza Neptuno en la máquina virtual: baja los cambios, recompila la web y reinicia.
# Uso:  sudo bash /opt/neptuno/deploy/azure/update.sh
set -euo pipefail
cd /opt/neptuno
set -a; . /etc/neptuno.env; set +a
git pull --ff-only
npm ci --include=dev --no-audit --no-fund
npm run build --prefix apps/web
systemctl restart neptuno
echo "LISTO-ACTUALIZADO: $(git log --oneline -1)"
