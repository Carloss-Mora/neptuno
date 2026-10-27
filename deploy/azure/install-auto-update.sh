#!/usr/bin/env bash
# Instala la actualización automática (cada 3 minutos). Uso:  sudo bash /opt/neptuno/deploy/azure/install-auto-update.sh
set -euo pipefail
cat > /etc/systemd/system/neptuno-update.service <<'UNIT'
[Unit]
Description=Actualizar Neptuno desde GitHub

[Service]
Type=oneshot
ExecStart=/bin/bash /opt/neptuno/deploy/azure/auto-update.sh
TimeoutStartSec=900
UNIT
cat > /etc/systemd/system/neptuno-update.timer <<'UNIT'
[Unit]
Description=Revisar cambios de Neptuno cada 3 minutos

[Timer]
OnBootSec=2min
OnUnitInactiveSec=3min

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now neptuno-update.timer
echo "Actualización automática instalada. Estado:"; systemctl list-timers neptuno-update.timer --no-pager | head -3
