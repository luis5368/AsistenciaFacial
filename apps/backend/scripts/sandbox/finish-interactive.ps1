# Ejecutar en terminal local propia, sin transcript ni captura de contraseñas.
$ErrorActionPreference = 'Stop'
$psqlExecutable = 'C:/Program Files/PostgreSQL/18/bin/psql.exe'
if (-not (Test-Path -LiteralPath $psqlExecutable)) { throw 'No se encontro psql 18.' }
$finishSql = Join-Path $PSScriptRoot 'finish-interactive.sql'
Write-Host 'Solo sandbox existente: psql solicita clave de postgres y nueva clave del migrador.'
Write-Host 'No se crean roles/bases, no se migra y no se modifica asistencia_facial.'
& $psqlExecutable -X -W -h localhost -p 5432 -U postgres -d asistencia_facial_sandbox -v ON_ERROR_STOP=1 -P pager=off -f $finishSql
if ($LASTEXITCODE -ne 0) { throw 'Paso interrumpido. Conservar recursos y revisar el resultado antes de reintentar.' }
