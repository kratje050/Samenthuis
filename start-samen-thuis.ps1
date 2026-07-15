param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$url = "http://localhost:$Port/"
$serverProcess = $null

function Test-SamenThuisServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-SamenThuisServer) {
  Write-Host "Samen Thuis draait al op $url" -ForegroundColor Green
  Start-Process $url
  Read-Host 'Druk op Enter om dit venster te sluiten'
  exit 0
}

$python = if (Get-Command py -ErrorAction SilentlyContinue) {
  @{ File = 'py'; Arguments = @('-m', 'http.server', $Port, '--bind', '127.0.0.1') }
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  @{ File = 'python'; Arguments = @('-m', 'http.server', $Port, '--bind', '127.0.0.1') }
} else {
  throw 'Python is niet gevonden. Installeer Python 3 of start de app met een andere lokale webserver.'
}

try {
  $serverProcess = Start-Process -FilePath $python.File -ArgumentList $python.Arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-SamenThuisServer) { break }
    Start-Sleep -Milliseconds 200
  }

  if (-not (Test-SamenThuisServer)) {
    throw 'De lokale webserver kon niet worden gestart.'
  }

  Write-Host ''
  Write-Host 'Samen Thuis is gestart.' -ForegroundColor Green
  Write-Host "Adres: $url"
  Write-Host 'Laat dit venster open zolang je de app test.'
  Write-Host ''
  Start-Process $url
  Read-Host 'Druk op Enter om de testserver te stoppen'
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
