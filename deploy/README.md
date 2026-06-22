# Despliegue a producción (VPS Linux + nginx estático)

Sube los cambios a producción y hace que **el cliente vea siempre la última
versión** (sin borrar caché a mano).

## Arquitectura real

nginx sirve directamente los archivos estáticos de **`/var/www/roomsmadrid`**
(el contenido de `dist/`: `assets/`, `brand/`, `imagenes/`, `favicon.ico`,
`index.html`). No hay proceso Node ni proxy para el sitio público.

La caché se fija en **nginx**:
- **`index.html` → `no-store`**: nunca se cachea; en cada visita se pide fresco.
- **`/assets/*` (con hash) → `immutable` 1 año**: el navegador descarga el nuevo
  solo cuando cambia el hash (cada build).

Por qué fallaba antes: el `index.html` se servía **sin `Cache-Control`**, así que
el navegador guardaba uno viejo (apuntando al JS viejo) y no veía los cambios.

## 1) Una sola vez en el VPS

Copia [`nginx-cache.conf`](./nginx-cache.conf) a tu config de nginx
(ajusta `server_name`; el `root` ya apunta a `/var/www/roomsmadrid`) y recarga:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
(Recomendado) SSH por clave para no escribir contraseña:
```bash
ssh-copy-id -p 22 root@reservas.roomsmadrid.es
```

## 2) Cada despliegue

Desde tu máquina (compila local y sube `dist/`):
```bash
VPS_HOST=reservas.roomsmadrid.es \
VPS_PATH=/var/www/roomsmadrid \
bash deploy/deploy.sh
```
El script: `npm run build` → `rsync dist/` al VPS (sin `--delete`, seguro) →
recarga nginx.

> No necesitas `git push` para que el deploy funcione: compila tu copia local
> (incluye cambios sin commitear). Aun así, **haz commit + push** para no perder
> el trabajo.

## Notas

- **Primera vez tras el arreglo:** un cliente con la versión vieja cacheada debe
  hacer **Ctrl+F5** una vez. Después, cada deploy se ve solo al recargar.
- **`--delete` (limpiar assets viejos):** el script NO lo usa por seguridad
  (borraría del VPS lo que no esté en `dist/`, p. ej. imágenes subidas a mano).
  Si quieres limpiar, usa primero `--dry-run` (ver comentario al final de
  `deploy.sh`).
- **HTTPS / certbot:** replica los `location` en el bloque `server` de `:443`.
- **CDN (Cloudflare…):** si lo usas, purga su caché tras desplegar.
- **Edge functions de Supabase** (pagos, triggers…) se despliegan aparte con
  `supabase functions deploy <nombre>`. Este deploy NO las toca.
