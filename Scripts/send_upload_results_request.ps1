param(
    [Parameter(Mandatory=$true)]
    [string]$xmlDirectory
)

$xmlFilePattern = "*Test*.xml"
$xmlFilePath = Get-ChildItem -Path $xmlDirectory -Recurse -Filter $xmlFilePattern | Select-Object -First 1 -ExpandProperty FullName

if (-not $xmlFilePath) {
    Write-Error "No XML file matching the pattern '$xmlFilePattern' found in the specified directory or its subdirectories."
    exit 1
}

$xmlContent = Get-Content -Path $xmlFilePath -Raw
$escapedXmlContent = [System.Security.SecurityElement]::Escape($xmlContent)

$jsonObject = @{
    "testRunName" = "Behave Test Run"
    "resultsXml" = $escapedXmlContent
}
$jsonString = $jsonObject | ConvertTo-Json

$url = "http://localhost:3000/upload-behave-tests-results"
$response = Invoke-RestMethod -Uri $url -Method Post -Body $jsonString -ContentType "application/json"
$responseString = $response | ConvertTo-Json -Depth 100
Write-Output $responseString