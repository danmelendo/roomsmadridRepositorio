# -----------------------------------------------------------------------------
# Despliegue a produccion (VPS + nginx estatico) desde Windows.
#
#   .\deploy.ps1            build + sube SOLO los archivos que han cambiado
#   .\deploy.ps1 -DryRun    build + lista lo que se subiria, sin tocar el VPS
#   .\deploy.ps1 -SkipBuild usa el dist/ que ya tengas
#
# Lee VPS_HOST, VPS_USER, VPS_PASSWORD, VPS_PATH, VPS_HOSTKEY y SITE_URL del .env
# (nunca se sube a git). Necesita PuTTY instalado (plink.exe / pscp.exe).
#
# Seguridad:
#   * Nunca borra nada del servidor (igual que rsync sin --delete).
#   * Copia primero assets/imagenes y al final cambia index.html de forma atomica,
#     asi nadie carga un index.html que apunte a un JS que aun no existe.
#   * Antes de cada deploy guarda index.html + assets en
#     /var/backups/roomsmadrid/pre-<fecha>.tgz. Se borran las copias de mas de
#     20 dias, salvo la mas reciente (nunca se queda sin respaldo).
#   * Al terminar comprueba la web; si no responde bien, restaura el index.html
#     anterior automaticamente.
#   * No recarga nginx: los archivos estaticos no lo necesitan.
# -----------------------------------------------------------------------------
param(
  [switch]$DryRun,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

# --- Config desde .env ---
if (-not (Test-Path ".env")) { Fail "No existe .env en la raiz del proyecto." }
$cfg = @{}
foreach ($line in Get-Content ".env") {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $cfg[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
foreach ($k in "VPS_HOST", "VPS_USER", "VPS_PASSWORD", "VPS_PATH", "VPS_HOSTKEY", "SITE_URL") {
  if (-not $cfg[$k]) { Fail "Falta $k en .env" }
}
$target = "$($cfg.VPS_USER)@$($cfg.VPS_HOST)"
$webPath = $cfg.VPS_PATH.TrimEnd("/")

# --- Herramientas ---
function Find-Tool($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $p = Join-Path $env:ProgramFiles "PuTTY\$name"
  if (Test-Path $p) { return $p }
  Fail "No encuentro $name. Instala PuTTY: https://www.putty.org/"
}
$plink = Find-Tool "plink.exe"
$pscp = Find-Tool "pscp.exe"
$tar = Join-Path $env:SystemRoot "System32\tar.exe"
if (-not (Test-Path $tar)) { Fail "No encuentro $tar (viene con Windows 10/11)." }

$sshArgs = @("-batch", "-hostkey", $cfg.VPS_HOSTKEY, "-pw", $cfg.VPS_PASSWORD)

function Invoke-Remote([string]$command) {
  $out = & $plink -ssh @sshArgs $target $command
  if ($LASTEXITCODE -ne 0) { Fail "Fallo el comando remoto:`n$out" }
  return $out
}

function Invoke-RemoteScript([string]$script) {
  # plink -m ejecuta un archivo de comandos; debe ir con saltos de linea LF.
  $f = Join-Path $env:TEMP "rm-deploy-remote.sh"
  [IO.File]::WriteAllText($f, ($script -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding $false))
  try {
    $out = & $plink -ssh @sshArgs -m $f $target
    $code = $LASTEXITCODE
  } finally { Remove-Item $f -ErrorAction SilentlyContinue }
  return @{ Output = ($out -join "`n"); Code = $code }
}

# --- 1. Build ---
if (-not $SkipBuild) {
  Step "1/5  Build de produccion (npm run build)"
  npm run build
  if ($LASTEXITCODE -ne 0) { Fail "El build ha fallado. No se ha subido nada." }
}
$dist = (Resolve-Path "dist").Path
if (-not (Test-Path (Join-Path $dist "index.html"))) { Fail "No existe dist/index.html." }

$indexHtml = Get-Content (Join-Path $dist "index.html") -Raw
$jsMatch = [regex]::Match($indexHtml, 'assets/[^"'']+\.js')
if (-not $jsMatch.Success) { Fail "dist/index.html no referencia ningun JS en assets/." }
$expectedJs = $jsMatch.Value

# --- 2. Diferencias con el servidor ---
Step "2/5  Comparando con $($cfg.VPS_HOST):$webPath"
$remote = @{}
foreach ($l in (Invoke-Remote "cd '$webPath' && find . -type f -exec md5sum {} +")) {
  if ($l -match '^([0-9a-f]{32})\s+\./(.+)$') { $remote[$Matches[2]] = $Matches[1] }
}
if ($remote.Count -eq 0) { Fail "No pude leer los archivos de $webPath en el servidor." }

$changed = New-Object System.Collections.Generic.List[string]
$bytes = 0
foreach ($file in Get-ChildItem $dist -Recurse -File) {
  $rel = $file.FullName.Substring($dist.Length + 1) -replace '\\', '/'
  $hash = (Get-FileHash $file.FullName -Algorithm MD5).Hash.ToLower()
  if ($remote[$rel] -ne $hash) { $changed.Add($rel); $bytes += $file.Length }
}

if ($changed.Count -eq 0) {
  Write-Host "Nada que subir: el servidor ya tiene esta version." -ForegroundColor Green
  exit 0
}
Write-Host ("{0} archivo(s) a subir, {1:N1} MB:" -f $changed.Count, ($bytes / 1MB))
$changed | Sort-Object | ForEach-Object { Write-Host "   $_" }

if ($DryRun) { Write-Host "`n(DryRun) No se ha subido nada." -ForegroundColor Yellow; exit 0 }

# --- 3. Empaquetar y subir ---
Step "3/5  Subiendo paquete"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$listFile = Join-Path $env:TEMP "rm-deploy-files.txt"
$pkg = Join-Path $env:TEMP "rm-deploy-$ts.tgz"
[IO.File]::WriteAllText($listFile, (($changed -join "`n") + "`n"), (New-Object Text.UTF8Encoding $false))
& $tar -czf $pkg -C $dist -T $listFile
if ($LASTEXITCODE -ne 0) { Fail "No pude crear el paquete." }
$remotePkg = "/tmp/rm-deploy-$ts.tgz"
& $pscp @sshArgs -q $pkg "${target}:$remotePkg"
$uploadCode = $LASTEXITCODE
Remove-Item $pkg, $listFile -ErrorAction SilentlyContinue
if ($uploadCode -ne 0) { Fail "Fallo la subida. El servidor no se ha modificado." }

# --- 4. Instalar en el servidor ---
Step "4/5  Instalando (assets primero, index.html al final)"
$install = @'
set -eu
WEB='__WEB__'
PKG='__PKG__'
TS='__TS__'
STAGE="/tmp/rm-deploy-$TS"
BK=/var/backups/roomsmadrid
mkdir -p "$STAGE" "$BK"
tar -xzf "$PKG" -C "$STAGE" --no-same-owner
chown -R www-data:www-data "$STAGE"
find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +
tar -czf "$BK/pre-$TS.tgz" -C "$WEB" index.html assets
# Retencion: borra copias de mas de 20 dias, pero nunca la mas reciente
# (asi nunca nos quedamos sin ningun respaldo).
NEWEST=$(ls -1t "$BK"/*.tgz 2>/dev/null | head -n 1)
find "$BK" -maxdepth 1 -type f -name '*.tgz' -mtime +20 ! -path "$NEWEST" -print -delete
if [ -f "$STAGE/index.html" ]; then mv "$STAGE/index.html" "$STAGE.index.html"; fi
cp -a "$STAGE/." "$WEB/"
if [ -f "$STAGE.index.html" ]; then
  cp -a "$STAGE.index.html" "$WEB/.index.html.new"
  mv -f "$WEB/.index.html.new" "$WEB/index.html"
fi
rm -rf "$STAGE" "$STAGE.index.html" "$PKG"
echo DEPLOY_OK
'@
$install = $install.Replace("__WEB__", $webPath).Replace("__PKG__", $remotePkg).Replace("__TS__", $ts)
$res = Invoke-RemoteScript $install
if ($res.Code -ne 0 -or $res.Output -notmatch "DEPLOY_OK") {
  Fail "La instalacion fallo en el servidor (la web sigue con el index.html anterior):`n$($res.Output)"
}

# --- 5. Verificacion + rollback automatico ---
Step "5/5  Verificando $($cfg.SITE_URL)"
$ok = $false
try {
  $page = Invoke-WebRequest "$($cfg.SITE_URL)/?v=$ts" -UseBasicParsing -TimeoutSec 20
  $js = Invoke-WebRequest "$($cfg.SITE_URL)/$expectedJs" -UseBasicParsing -TimeoutSec 30 -Method Head
  $ok = $page.StatusCode -eq 200 -and $page.Content -match [regex]::Escape($expectedJs) -and $js.StatusCode -eq 200
} catch { Write-Host $_.Exception.Message -ForegroundColor Yellow }

if (-not $ok) {
  Write-Host "La verificacion ha fallado. Restaurando el index.html anterior..." -ForegroundColor Red
  $rb = Invoke-RemoteScript "set -eu; tar -xzf /var/backups/roomsmadrid/pre-$ts.tgz -C '$webPath' index.html; echo ROLLBACK_OK"
  if ($rb.Output -match "ROLLBACK_OK") { Fail "Rollback hecho: la web vuelve a la version anterior." }
  Fail "El rollback tambien fallo. Restaura a mano: tar -xzf /var/backups/roomsmadrid/pre-$ts.tgz -C $webPath"
}

Write-Host "`nDespliegue completado: $($cfg.SITE_URL) sirve $expectedJs" -ForegroundColor Green
Write-Host "Copia previa en el VPS: /var/backups/roomsmadrid/pre-$ts.tgz"
