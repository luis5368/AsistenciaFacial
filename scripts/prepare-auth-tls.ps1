$ErrorActionPreference = 'Stop'
$tlsDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.tmp/tls-auth'))
$openssl = 'C:/Program Files/Git/usr/bin/openssl.exe'
if (-not (Test-Path -LiteralPath $openssl)) { throw 'OpenSSL no disponible; configurar una herramienta local revisada.' }
if (Test-Path -LiteralPath $tlsDir) { throw 'Directorio TLS ya existe; conservar y revisar, no sobrescribir.' }
$null = New-Item -ItemType Directory -Path $tlsDir
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true,$false)
foreach ($sid in @([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')) {
  $identity = New-Object System.Security.Principal.SecurityIdentifier($sid)
  $acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
}
Set-Acl -LiteralPath $tlsDir -AclObject $acl
& $openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 30 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1' -keyout "$tlsDir/localhost.key" -out "$tlsDir/localhost.crt" 2>$null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar certificado local; no usar artefactos parciales.' }
Write-Output 'Certificado local generado; no instalado en almacenes del sistema.'
