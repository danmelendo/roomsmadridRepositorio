#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Despliegue a producción (VPS Linux + nginx sirviendo estáticos).
#
#   1. Compila el frontend EN TU MÁQUINA (npm run build → dist/)
#   2. Sube el contenido de dist/ a /var/www/roomsmadrid por rsync
#   3. Recarga nginx
#
# Como nginx no cachea index.html y los assets llevan hash (ver nginx-cache.conf),
# el cliente recibe la versión nueva en cuanto recarga. No hay que purgar caché.
#
# USO (desde la raíz del proyecto):
#   VPS_HOST=reservas.roomsmadrid.es VPS_PATH=/var/www/roomsmadrid bash deploy/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── CONFIGURA (o pásalo por entorno) ──
VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-reservas.roomsmadrid.es}"
SSH_PORT="${SSH_PORT:-22}"
VPS_PATH="${VPS_PATH:-/var/www/roomsmadrid}"   # carpeta que sirve nginx
# ──────────────────────────────────────

cd "$(dirname "$0")/.."   # raíz del proyecto

echo "▶ 1/3  Build de producción…"
npm run build
[ -f dist/index.html ] || { echo "✗ No se generó dist/index.html. Abortando."; exit 1; }

echo "▶ 2/3  Subiendo dist/ → ${VPS_USER}@${VPS_HOST}:${VPS_PATH}"
# SIN --delete: solo añade/actualiza, nunca borra (seguro). Los assets viejos
# quedan huérfanos pero son inofensivos. Para limpiarlos de vez en cuando, mira
# el comentario de abajo.
rsync -avz --human-readable -e "ssh -p ${SSH_PORT}" \
  dist/ "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

echo "▶ 3/3  Recargando nginx…"
ssh -p "${SSH_PORT}" "${VPS_USER}@${VPS_HOST}" "sudo nginx -t && sudo systemctl reload nginx"

echo "✅ Despliegue completado. El cliente verá la versión nueva al recargar"
echo "   (la primera vez, si tenía la vieja cacheada: Ctrl+F5 una sola vez)."

# ─────────────────────────────────────────────────────────────────────────────
# LIMPIEZA OPCIONAL de assets viejos (usa --delete). ¡PELIGRO! borra del servidor
# lo que no esté en dist/. Si subiste imágenes a mano al VPS que NO están en el
# repo (public/), se borrarían. Comprueba SIEMPRE primero con --dry-run:
#
#   rsync -avzn --delete -e "ssh -p ${SSH_PORT}" dist/ "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
#   # revisa la lista de "deleting ..."; si es solo /assets viejos, repite sin la 'n':
#   rsync -avz  --delete -e "ssh -p ${SSH_PORT}" dist/ "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
# ─────────────────────────────────────────────────────────────────────────────
