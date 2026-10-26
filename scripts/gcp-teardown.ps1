<#
.SYNOPSIS
    ResearchHub OS — Nuclear Teardown Automation (PowerShell)
.DESCRIPTION
    Permanently unlinks billing and deletes the entire GCP project and all associated resources
    (Cloud Run microservices, Artifact Registry, Secrets, IAM bindings) to guarantee zero lingering charges.
.PARAMETER ProjectId
    The GCP project ID to shut down (e.g. researchhub-os-1234)
.PARAMETER Force
    Skip interactive confirmation (useful for automated cleanup pipelines)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectId,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Exec-Step {
    param([string]$Description, [scriptblock]$Action)
    Write-Host "`n==> $Description" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    try {
        & $Action
    } catch {
        Write-Host "`n[FATAL ERROR] Step threw an exception: $Description" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host "Aborting teardown to prevent invalid state." -ForegroundColor Red
        exit 1
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[FATAL ERROR] Step failed: $Description (Exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Aborting teardown to prevent invalid state." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host " [OK] $Description completed." -ForegroundColor Green
}

Write-Host "`n=================================================================" -ForegroundColor Red
Write-Host " [ResearchHub OS] GCP Project Teardown & Billing Decommission" -ForegroundColor Red
Write-Host "=================================================================" -ForegroundColor Red

# Pre-flight: Check gcloud CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "`n[ERROR] 'gcloud' CLI is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install`n" -ForegroundColor Yellow
    exit 1
}

# Resolve target Project ID
if (-not $ProjectId) {
    $currentProj = gcloud config get-value project 2>$null
    if ($currentProj -and $currentProj.Trim() -ne "(unset)") {
        $ProjectId = $currentProj.Trim()
        Write-Host "Detected active GCP project: $ProjectId" -ForegroundColor Gray
    } else {
        $ProjectId = (Read-Host "Enter the GCP Project ID to delete").Trim()
    }
}

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    Write-Host "[ERROR] A valid Project ID must be specified." -ForegroundColor Red
    exit 1
}

# Verify the project actually exists on GCP
$projectInfo = gcloud projects describe $ProjectId --format="value(projectId)" 2>$null
if (-not $projectInfo) {
    Write-Host "[ERROR] Project '$ProjectId' was not found or you do not have permission to access it." -ForegroundColor Red
    exit 1
}

# Safety confirmation prompt
if (-not $Force) {
    Write-Host "`n=================================================================" -ForegroundColor Yellow
    Write-Host " WARNING: This will permanently unlink billing and delete the GCP project" -ForegroundColor Red
    Write-Host " '$ProjectId' and all associated resources:" -ForegroundColor Red
    Write-Host "   - All Cloud Run microservices & API Gateway" -ForegroundColor Yellow
    Write-Host "   - Artifact Registry container images & repositories" -ForegroundColor Yellow
    Write-Host "   - Secret Manager secrets & IAM permissions" -ForegroundColor Yellow
    Write-Host "   - Google Cloud billing link (immediate spend halt)" -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow
    
    $confirm = Read-Host "`nType the project ID ('$ProjectId') to confirm total project deletion"
    if ($confirm.Trim() -ne $ProjectId) {
        Write-Host "`n[CANCELLED] Confirmation input did not match '$ProjectId'. Teardown aborted." -ForegroundColor Green
        exit 0
    }
}

Write-Host "`nExecuting total GCP project shutdown & billing teardown..." -ForegroundColor Red

# Billing Guard: Unlink billing to guarantee immediate spend halt
$billingAcct = (gcloud billing projects describe $ProjectId --format="value(billingAccountName)" 2>$null)
if ($billingAcct -and $billingAcct.Trim() -ne "") {
    Exec-Step "Billing Guard: Unlinking billing account from project $ProjectId (Immediate Spend Halt)" {
        gcloud billing projects unlink $ProjectId --quiet
    }
} else {
    Write-Host "No active billing account linked to project $ProjectId." -ForegroundColor Gray
}

# Disable Firebase hosting if CLI is installed
if (Get-Command firebase -ErrorAction SilentlyContinue) {
    try {
        Write-Host "Disabling Firebase Hosting for $ProjectId..." -ForegroundColor Gray
        firebase hosting:disable --project $ProjectId --force 2>$null
    } catch {
        # Best-effort
    }
}

# Clean up Load Balancer resources & IP (best-effort)
Write-Host "Releasing Load Balancer resources..." -ForegroundColor Gray
try {
    gcloud compute forwarding-rules delete rh-http-forwarding-rule --global --project=$ProjectId --quiet 2>$null | Out-Null
    gcloud compute target-http-proxies delete rh-http-proxy --global --project=$ProjectId --quiet 2>$null | Out-Null
    gcloud compute url-maps delete rh-url-map --global --project=$ProjectId --quiet 2>$null | Out-Null
    gcloud compute backend-services delete rh-gateway-backend --global --project=$ProjectId --quiet 2>$null | Out-Null
    gcloud compute addresses delete rh-global-ip --global --project=$ProjectId --quiet 2>$null | Out-Null
} catch {}

# Execute project shutdown
Exec-Step "Permanently deleting GCP project: $ProjectId" {
    gcloud projects delete $ProjectId --quiet
}

# Reset local env file to default /api
$envProd = "$PSScriptRoot\..\frontend\.env.production"
if (Test-Path $envProd) {
    Set-Content -Path $envProd -Value "VITE_API_URL=/api" -Encoding UTF8
    Write-Host "Reset frontend/.env.production to default '/api'." -ForegroundColor Gray
}

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] GCP Project '$ProjectId' decommission complete." -ForegroundColor Green
Write-Host " Billing is unlinked and all cloud resources are terminated." -ForegroundColor Green
Write-Host " Zero lingering charges will occur." -ForegroundColor Green
Write-Host "=================================================================`n" -ForegroundColor Green
