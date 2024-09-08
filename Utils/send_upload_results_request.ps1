param(
    [Parameter(Mandatory=$true)]
    [string]$xmlFilePath
)

$xmlContent = Get-Content -Path $xmlFilePath -Raw
$escapedXmlContent = [System.Security.SecurityElement]::Escape($xmlContent)

$jsonObject = @{
    "testRunName" = "Behave Test Run No 1"
    "resultsXml" = $escapedXmlContent
}
$jsonString = $jsonObject | ConvertTo-Json

$url = "http://localhost:3000/upload-behave-tests-results"
$response = Invoke-RestMethod -Uri $url -Method Post -Body $jsonString -ContentType "application/json"
$responseString = $response | ConvertTo-Json -Depth 100
Write-Output $responseString