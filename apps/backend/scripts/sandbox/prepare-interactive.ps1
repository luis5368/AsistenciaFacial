# Ejecutar en terminal local propia, nunca con Start-Transcript ni redirigir prompts.
# No recibe ni lee contraseñas: psql las solicita directamente al operador.
$ErrorActionPreference = 'Stop'
$psqlExecutable = 'C:/Program Files/PostgreSQL/18/bin/psql.exe'
if (-not (Test-Path -LiteralPath $psqlExecutable)) { throw 'No se encontro psql 18.' }
$preparationSql = Join-Path $PSScriptRoot 'prepare-interactive.sql'
Write-Host 'Se crearan asistencia_migrator y asistencia_facial_sandbox. Si alguno existe, se detendra.'
Write-Host 'psql solicitara la clave de postgres y despues la nueva clave del migrador.'
Write-Host 'No se aplicaran migraciones ni se modificara asistencia_facial.'
& $psqlExecutable -X -W -h localhost -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off -f $preparationSql
$preparationExit = $LASTEXITCODE
if ($preparationExit -ne 0) {
  throw 'Preparacion interrumpida. Puede haber quedado un rol o una sandbox parcial: revisar antes de reintentar; no se borrara nada automaticamente.'
}
