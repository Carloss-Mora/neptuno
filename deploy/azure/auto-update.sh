#!/usr/bin/env bash
# Se ejecuta cada pocos minutos: si hay cambios nuevos en GitHub, actualiza la aplicación.
# Deja de actualizar solo después de la hora de congelación, para que nada cambie durante la exposición.
set -uo pipefail
FREEZE_AT=$(date -u -d '2026-10-27 11:30' +%s)
if [ "$(date -u +%s)" -ge "$FREEZE_AT" ]; then exit 0; fi
cd /opt/neptuno
git fetch -q origin main || exit 0
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0
echo "[auto-update] cambios nuevos, actualizando…"
bash /opt/neptuno/deploy/azure/update.sh
