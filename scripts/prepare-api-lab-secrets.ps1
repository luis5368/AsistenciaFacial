$ErrorActionPreference = 'Stop'
# Ejecutar por el responsable en una terminal local, sin Start-Transcript.
# No conecta a PostgreSQL, no crea cuentas y no cambia roles.
$target = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/backend/.env.api-lab'))
if (Test-Path -LiteralPath $target) { throw 'El archivo ya existe. No se sobrescribe; revisar localmente.' }
function Read-PrivateValue([string]$prompt) {
  $secure = Read-Host $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secure.Dispose() }
}
$migrationSecret = $null; $fixtureSecret = $null; $nextSecret = $null; $payload = $null
try {
  $migrationSecret = Read-PrivateValue 'Contrasena EXISTENTE de asistencia_migrator (no se cambiara)'
  $fixtureSecret = Read-PrivateValue 'Frase ficticia inicial para el ensayo (15 a 128 caracteres)'
  $nextSecret = Read-PrivateValue 'Frase ficticia distinta para probar cambio de contrasena (15 a 128 caracteres)'
  if ([string]::IsNullOrEmpty($migrationSecret)) { throw 'Credencial migradora vacia.' }
  foreach ($secret in @($fixtureSecret,$nextSecret)) {
    if ($secret.Length -lt 15 -or $secret.Length -gt 128 -or $secret.Contains("`r") -or $secret.Contains("`n")) {
      throw 'Frase de ensayo invalida; no se escribio configuracion.'
    }
  }
  if ($fixtureSecret -ceq $nextSecret) { throw 'Las frases de ensayo deben ser diferentes.' }
  # Base64 es transporte, NO cifrado. El archivo completo se protege como secreto.
  $fixtureEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($fixtureSecret))
  $nextEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($nextSecret))
  $migrationUrl = 'postgresql://asistencia_migrator:' + [Uri]::EscapeDataString($migrationSecret) + '@localhost:5432/asistencia_facial_api_lab'
  $payload = "API_LAB_MIGRATION_DATABASE_URL=$migrationUrl`nAPI_LAB_FIXTURE_PASSWORD_BASE64=$fixtureEncoded`nAPI_LAB_NEXT_PASSWORD_BASE64=$nextEncoded`n"
  # Crear vacio, restringir ACL y solo entonces escribir datos sensibles.
  $stream = [IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $stream.Dispose()
  $acl = New-Object Security.AccessControl.FileSecurity
  $acl.SetAccessRuleProtection($true,$false)
  foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')) {
    $identity = New-Object Security.Principal.SecurityIdentifier($sid)
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','Allow')))
  }
  Set-Acl -LiteralPath $target -AclObject $acl
  [IO.File]::WriteAllText($target,$payload,(New-Object Text.UTF8Encoding($false)))
  Write-Output 'Configuracion privada preparada. No se realizaron operaciones de base de datos.'
} finally {
  $migrationSecret=$null; $fixtureSecret=$null; $nextSecret=$null; $migrationUrl=$null
  $fixtureEncoded=$null; $nextEncoded=$null; $payload=$null
}
