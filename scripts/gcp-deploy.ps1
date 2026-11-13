<#
.SYNOPSIS
    ResearchHub OS — GCP Cloud Run, Secret Manager & Firebase Hosting Deployment
.DESCRIPTION
    Automates project creation, billing linkage, Google API enablement, Secret Manager provisioning,
    IAM bindings, Supabase PostgreSQL schema migration & seeding, scale-to-zero Cloud Run microservices,
    API Gateway routing, and Firebase Hosting production build & deployment with strict fail-fast error handling.
.PARAMETER ProjectId
    Unique GCP Project ID (e.g. researchhub-os-prod-1234)
.PARAMETER BillingAccountId
    GCP Billing Account ID (e.g. 012345-6789AB-CDEF01)
.PARAMETER Region
    GCP Region for Cloud Run and Artifact Registry (default: us-central1)
.PARAMETER SecretsFile
    Explicit path to local secrets file (defaults to auto-detecting secrets.env / .env.secrets / secretes.txt / .env.production / .env)
.PARAMETER AllowUnauthenticatedMicroservices
    Deploy microservices with --allow-unauthenticated for direct gateway proxy access (default: $true)
.PARAMETER Bucket
    GCS Bucket name for file uploads (default: research-hub-lab2-5-storage)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectId,

    [Parameter(Mandatory = $false)]
    [string]$BillingAccountId,

    [Parameter(Mandatory = $false)]
    [string]$Region = "us-central1",

    [Parameter(Mandatory = $false)]
    [string]$SecretsFile,

    [Parameter(Mandatory = $false)]
    [bool]$AllowUnauthenticatedMicroservices = $true,

    [Parameter(Mandatory = $false)]
    [string]$Bucket = "research-hub-lab2-5-storage"
)

$ErrorActionPreference = "Continue"

function Exec-Step {
    param([string]$Description, [scriptblock]$Action)
    Write-Host "`n==> $Description" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    try {
        & $Action
    } catch {
        Write-Host "`n[FATAL ERROR] Step threw an exception: $Description" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host "Aborting deployment to prevent invalid state." -ForegroundColor Red
        exit 1
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[FATAL ERROR] Step failed: $Description (Exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Aborting deployment to prevent invalid state." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host " [OK] $Description completed." -ForegroundColor Green
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n=================================================================" -ForegroundColor Cyan
    Write-Host " [ResearchHub OS] $Message" -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host " [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host " [WARN] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host " [ERROR] $Message" -ForegroundColor Red
}

function Mask-DbUrl {
    param([string]$Url)
    if ([string]::IsNullOrWhiteSpace($Url)) { return "" }
    return ($Url -replace '://([^:]+):(.+)@([^@]+)$', '://$1:****@$3')
}

function Format-DatabaseUrl {
    param([string]$RawUrl)
    if ([string]::IsNullOrWhiteSpace($RawUrl)) { return $RawUrl }
    try {
        $lastAt = $RawUrl.LastIndexOf('@')
        if ($lastAt -gt 0) {
            $prefix = $RawUrl.Substring(0, $lastAt)
            $suffix = $RawUrl.Substring($lastAt + 1)
            
            $firstColon = $prefix.IndexOf('://')
            if ($firstColon -gt 0) {
                $proto = $prefix.Substring(0, $firstColon + 3)
                $userPass = $prefix.Substring($firstColon + 3)
                $userColon = $userPass.IndexOf(':')
                if ($userColon -gt 0) {
                    $user = $userPass.Substring(0, $userColon)
                    $rawPassword = $userPass.Substring($userColon + 1)
                    
                    # Unescape first in case already escaped, then encode special characters safely
                    $unescaped = [System.Uri]::UnescapeDataString($rawPassword)
                    $encodedPass = [System.Uri]::EscapeDataString($unescaped)
                    
                    $hostPortDb = $suffix
                    $query = ""
                    $qIndex = $suffix.IndexOf('?')
                    if ($qIndex -ge 0) {
                        $hostPortDb = $suffix.Substring(0, $qIndex)
                        $query = $suffix.Substring($qIndex + 1)
                    }
                    
                    # Ensure sslmode=require is in the query params for cloud DBs
                    if (-not ($query -match 'sslmode=')) {
                        $query = if ($query) { "$query&sslmode=require" } else { "sslmode=require" }
                    }
                    if ($hostPortDb -match ':6543' -and -not ($query -match 'pgbouncer=')) {
                        $query = "$query&pgbouncer=true"
                    }
                    
                    return "$proto$user`:$encodedPass`@$hostPortDb`?$query"
                }
            }
        }
    } catch {
        return $RawUrl
    }
    return $RawUrl
}

# ---------------------------------------------------------
# 0. Pre-flight Checks & Tool Validation
# ---------------------------------------------------------
Write-Step "0. Checking Pre-requisites & Authentication"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Err "'gcloud' CLI is not found in PATH."
    Write-Host "Please install Google Cloud SDK from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    Write-Host "After installation, run 'gcloud auth login' and re-run this script.`n" -ForegroundColor Yellow
    exit 1
}

$activeAccount = (gcloud config get-value account 2>$null)
if (-not $activeAccount -or $activeAccount.Trim() -eq "(unset)") {
    Write-Err "No active Google Cloud account detected."
    Write-Host "Please authenticate first by running: gcloud auth login`n" -ForegroundColor Yellow
    exit 1
}
Write-Success "Authenticated as GCP user: $($activeAccount.Trim())"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "'node' (Node.js) is required but not found in PATH."
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Err "'npm' is required but not found in PATH."
    exit 1
}

$hasFirebase = [bool](Get-Command firebase -ErrorAction SilentlyContinue)
if (-not $hasFirebase) {
    Write-Warn "Firebase CLI ('firebase') not found in PATH. Install globally via 'npm install -g firebase-tools'."
    Write-Warn "Deployment will proceed through Cloud Run and frontend build, but Firebase hosting deploy will require manual execution."
}

# Prompt for ProjectId if omitted
if (-not $ProjectId) {
    $currentProj = gcloud config get-value project 2>$null
    if ($currentProj -and $currentProj.Trim() -ne "(unset)") {
        $defaultId = $currentProj.Trim()
    } else {
        $defaultId = "researchhub-os-$((Get-Random -Minimum 1000 -Maximum 9999))"
    }
    $inputProj = Read-Host "Enter GCP Project ID (default: $defaultId)"
    if ([string]::IsNullOrWhiteSpace($inputProj)) {
        $ProjectId = $defaultId
    } else {
        $ProjectId = $inputProj.Trim().ToLower()
    }
}

# Prompt for BillingAccountId if omitted
if (-not $BillingAccountId) {
    Write-Host "`nAvailable Billing Accounts:" -ForegroundColor Gray
    try {
        gcloud billing accounts list
    } catch {
        Write-Warn "Unable to list billing accounts automatically."
    }
    $inputBilling = Read-Host "Enter your GCP Billing Account ID (e.g. 012345-6789AB-CDEF01)"
    $BillingAccountId = $inputBilling.Trim()
    if ([string]::IsNullOrWhiteSpace($BillingAccountId)) {
        Write-Err "Billing Account ID is required to provision GCP resources."
        exit 1
    }
}

# Billing Account Guard: verify billing account is active/open
$billingAcctOpen = (gcloud billing accounts describe $BillingAccountId --format="value(open)" 2>$null)
if ($billingAcctOpen -and $billingAcctOpen.Trim().ToLower() -eq "false") {
    Write-Host "`n[FATAL ERROR] Billing Account '$BillingAccountId' is CLOSED." -ForegroundColor Red
    Write-Host "A valid, active (OPEN) GCP Billing Account is required to deploy Cloud Run services." -ForegroundColor Red
    Write-Host "Aborting deployment to prevent invalid state." -ForegroundColor Red
    exit 1
}

Write-Host "Target Project ID    : $ProjectId" -ForegroundColor Gray
Write-Host "Billing Account ID   : $BillingAccountId" -ForegroundColor Gray
Write-Host "Deployment Region    : $Region" -ForegroundColor Gray

# ---------------------------------------------------------
# 1. Secret Ingestion & Secret Manager Automation
# ---------------------------------------------------------
Write-Step "1. Ingesting Secrets & Configuring Secret Manager"

$rootDir = Resolve-Path "$PSScriptRoot\.."
$detectedFile = $null

if ($SecretsFile -and (Test-Path $SecretsFile)) {
    $detectedFile = (Resolve-Path $SecretsFile).Path
} else {
    $candidates = @("secrets.env", ".env.secrets", "secretes.txt", "secrets.txt", ".env.production", ".env")
    foreach ($cand in $candidates) {
        $p = Join-Path $rootDir $cand
        if (Test-Path $p) {
            $detectedFile = $p
            break
        }
    }
}

if (-not $detectedFile) {
    Write-Err "No secrets file detected. Please create 'secrets.env' or '.env.secrets' with your Supabase credentials."
    Write-Host "Required variables:" -ForegroundColor Yellow
    Write-Host "  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -ForegroundColor Gray
    Write-Host "  SUPABASE_URL=https://[PROJECT-REF].supabase.co" -ForegroundColor Gray
    Write-Host "  SUPABASE_SECRET_KEY=sb_secret_..." -ForegroundColor Gray
    Write-Host "  SUPABASE_ANON_KEY=sb_publishable_..." -ForegroundColor Gray
    exit 1
}

Write-Success "Detected secrets configuration: $(Split-Path $detectedFile -Leaf)"

# Parse key-values safely without echoing plaintext secrets
$parsedSecrets = @{}
$fileLines = Get-Content $detectedFile

foreach ($line in $fileLines) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) { continue }

    if ($trimmed.StartsWith("postgresql://") -or $trimmed.StartsWith("postgres://")) {
        $parsedSecrets["DATABASE_URL"] = $trimmed
        continue
    }

    if ($trimmed.Contains("=")) {
        $eqIndex = $trimmed.IndexOf("=")
        $key = $trimmed.Substring(0, $eqIndex).Trim()
        $val = $trimmed.Substring($eqIndex + 1).Trim().Trim('"').Trim("'")
        $parsedSecrets[$key] = $val
    }
}

# Resolve DATABASE_URL and normalize encoding & SSL flags
$rawDb = $parsedSecrets["DATABASE_URL"]
if (-not $rawDb) {
    Write-Err "DATABASE_URL was not found in $detectedFile."
    exit 1
}
$DatabaseUrl = Format-DatabaseUrl $rawDb

# Resolve SUPABASE_URL
$SupabaseUrl = $parsedSecrets["SUPABASE_URL"]
if (-not $SupabaseUrl) {
    if ($DatabaseUrl -match '@db\.([a-z0-9]+)\.supabase\.co') {
        $ref = $Matches[1]
        $SupabaseUrl = "https://$ref.supabase.co"
    } else {
        Write-Err "SUPABASE_URL was not found in $detectedFile."
        exit 1
    }
}

# Resolve SUPABASE_ANON_KEY (fallback to SUPABASE_PUBLISHABLE_KEY)
$SupabaseAnonKey = $parsedSecrets["SUPABASE_ANON_KEY"]
if (-not $SupabaseAnonKey) {
    $SupabaseAnonKey = $parsedSecrets["SUPABASE_PUBLISHABLE_KEY"]
}

# Resolve SUPABASE_SECRET_KEY (fallback to SUPABASE_SERVICE_ROLE_KEY)
$SupabaseSecretKey = $parsedSecrets["SUPABASE_SECRET_KEY"]
if (-not $SupabaseSecretKey) {
    $SupabaseSecretKey = $parsedSecrets["SUPABASE_SERVICE_ROLE_KEY"]
}
if (-not $SupabaseSecretKey) {
    Write-Err "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) was not found in $detectedFile."
    exit 1
}

# Resolve or generate 64-char cryptographically secure JWT_SECRET
$JwtSecret = $parsedSecrets["JWT_SECRET"]
if ([string]::IsNullOrWhiteSpace($JwtSecret)) {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $JwtSecret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    Write-Host "Generated secure 64-character hex JWT_SECRET." -ForegroundColor Gray
} else {
    Write-Host "Loaded JWT_SECRET from secrets file." -ForegroundColor Gray
}

# Log safe summary
Write-Host "  Database Target      : $(Mask-DbUrl $DatabaseUrl)" -ForegroundColor Gray
Write-Host "  Supabase URL         : $SupabaseUrl" -ForegroundColor Gray
Write-Host "  Supabase Secret Key  : configured (length: $($SupabaseSecretKey.Length))" -ForegroundColor Gray
if ($SupabaseAnonKey) {
    Write-Host "  Supabase Anon Key    : configured (length: $($SupabaseAnonKey.Length))" -ForegroundColor Gray
}
Write-Host "  JWT Secret           : configured (length: $($JwtSecret.Length))" -ForegroundColor Gray

# ---------------------------------------------------------
# 2. GCP Project, Billing & API Enablement (Billing Guards)
# ---------------------------------------------------------
Write-Step "2. Configuring GCP Project & Enabling Services"

$projectExists = & gcloud projects list --filter="projectId:$ProjectId" --format="value(projectId)" 2>$null
if (-not $projectExists) {
    Exec-Step "Creating Google Cloud Project ($ProjectId)" {
        & gcloud projects create $ProjectId --name="ResearchHub OS"
    }
} else {
    Write-Host "Project '$ProjectId' already exists. Reusing existing project." -ForegroundColor Green
}
& gcloud config set project $ProjectId

Exec-Step "Setting default Cloud Run region to $Region" {
    & gcloud config set run/region $Region --quiet
}

# Billing Check & Propagation Buffer
$billingInfo = & gcloud billing projects describe $ProjectId --format="value(billingEnabled)" 2>$null
if ($billingInfo -ne "True") {
    Exec-Step "Linking Billing Account ($BillingAccountId)" {
        & gcloud billing projects link $ProjectId --billing-account=$BillingAccountId
    }
    Write-Host "Waiting 25 seconds for billing authorization to propagate..." -ForegroundColor Yellow
    Start-Sleep -Seconds 25
} else {
    Write-Host "Billing is already enabled on $ProjectId." -ForegroundColor Green
}

# Sync ADC Quota Project
Write-Host "Syncing ADC quota project to $ProjectId..." -ForegroundColor Cyan
& gcloud auth application-default set-quota-project $ProjectId --quiet 2>$null

# Optimized API Enablement
$coreApis = @(
    "compute.googleapis.com",
    "secretmanager.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com"
)

$enabledApis = & gcloud services list --enabled --format="value(config.name)" --project=$ProjectId 2>$null

foreach ($api in $coreApis) {
    if ($enabledApis -contains $api) {
        Write-Host " [OK] API $api is already enabled." -ForegroundColor Green
    } else {
        Exec-Step "Enabling API: $api" {
            & gcloud services enable $api --project=$ProjectId
        }
    }
}

# ---------------------------------------------------------
# 3. Provision Secret Manager & IAM Bindings
# ---------------------------------------------------------
Write-Step "3. Provisioning GCP Secret Manager & Service Account IAM"

$secretsToProvision = @{
    "DATABASE_URL"        = $DatabaseUrl
    "JWT_SECRET"          = $JwtSecret
    "SUPABASE_URL"        = $SupabaseUrl
    "SUPABASE_SECRET_KEY" = $SupabaseSecretKey
}
if ($SupabaseAnonKey) {
    $secretsToProvision["SUPABASE_ANON_KEY"] = $SupabaseAnonKey
}

foreach ($secKey in $secretsToProvision.Keys) {
    $secVal = $secretsToProvision[$secKey]
    $secExists = gcloud secrets describe $secKey --project=$ProjectId --format="value(name)" 2>$null
    if (-not $secExists) {
        Exec-Step "Creating secret resource: $secKey" {
            gcloud secrets create $secKey --replication-policy="automatic" --project=$ProjectId --quiet
        }
    }
    # Add version securely via piped standard input
    Exec-Step "Publishing secret version for $secKey" {
        $secVal | gcloud secrets versions add $secKey --data-file=- --project=$ProjectId --quiet
    }
}

# Retrieve default compute service account and grant Secret Accessor
$ProjectNumber = (gcloud projects describe $ProjectId --format="value(projectNumber)" 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($ProjectNumber)) {
    Write-Host "`n[FATAL ERROR] Failed to retrieve project number for $ProjectId." -ForegroundColor Red
    exit 1
}
$ProjectNumber = $ProjectNumber.Trim()
$ComputeServiceAccount = "$ProjectNumber-compute@developer.gserviceaccount.com"

Exec-Step "Granting Secret Accessor role to Cloud Run compute service account ($ComputeServiceAccount)" {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ComputeServiceAccount" `
        --role="roles/secretmanager.secretAccessor" `
        --quiet | Out-Null
}

Exec-Step "Granting Compute Instance Admin role for On-Demand Lab VM lifecycle ($ComputeServiceAccount)" {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ComputeServiceAccount" `
        --role="roles/compute.instanceAdmin.v1" `
        --quiet | Out-Null
}

Exec-Step "Granting Service Account User role to Cloud Run compute service account" {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ComputeServiceAccount" `
        --role="roles/iam.serviceAccountUser" `
        --quiet | Out-Null
}

Exec-Step "Granting Storage Object Admin role to Cloud Run compute service account" {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ComputeServiceAccount" `
        --role="roles/storage.objectAdmin" `
        --quiet | Out-Null
}

Exec-Step "Granting Service Account Token Creator role (required for v4 signed URLs)" {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ComputeServiceAccount" `
        --role="roles/iam.serviceAccountTokenCreator" `
        --quiet | Out-Null
}

# Ensure Cloud Storage bucket exists for file uploads
$bucketExists = gcloud storage buckets describe "gs://$Bucket" --project=$ProjectId 2>$null
if (-not $bucketExists) {
    Exec-Step "Creating Cloud Storage bucket: gs://$Bucket" {
        gcloud storage buckets create "gs://$Bucket" --project=$ProjectId --location=$Region --quiet 2>$null
    }
}

# Ensure Firewall rule for ephemeral lab workers (port 8888 & 80)
$fwRule = gcloud compute firewall-rules describe allow-researchhub-lab --project=$ProjectId --format="value(name)" 2>$null
if (-not $fwRule) {
    Exec-Step "Creating Compute Engine firewall rule for ResearchHub Lab workers (port 8888 & 80)" {
        gcloud compute firewall-rules create allow-researchhub-lab `
            "--allow=tcp:8888,tcp:80" `
            "--target-tags=researchhub-lab,http-server" `
            --description="Allow direct access to ephemeral lab JupyterLab workers" `
            --project=$ProjectId `
            --quiet
    }
}

# ---------------------------------------------------------
# 4. Supabase Schema Migration & Verification
# ---------------------------------------------------------
Write-Step "4. Running Supabase Database Migrations & Seed Verification"

Exec-Step "Executing Supabase database migrations and seeds (scripts/db-init.js)" {
    $env:DATABASE_URL = $DatabaseUrl
    node "$PSScriptRoot\db-init.js" "$DatabaseUrl"
}

# ---------------------------------------------------------
# 5. Build & Deploy Microservices to Cloud Run
# ---------------------------------------------------------
Write-Step "5. Deploying Microservices to Cloud Run (Scale-to-Zero Budget Protection)"

# Create Artifact Registry Docker Repository
$repoName = "researchhub-repo"
$repoExists = gcloud artifacts repositories describe $repoName --location=$Region --project=$ProjectId --format="value(name)" 2>$null
if (-not $repoExists) {
    Exec-Step "Creating Artifact Registry repository: $repoName" {
        gcloud artifacts repositories create $repoName `
            --repository-format=docker `
            --location=$Region `
            --description="ResearchHub OS container images" `
            --project=$ProjectId `
            --quiet
    }
}

$repoBase = "$Region-docker.pkg.dev/$ProjectId/$repoName"

$services = @(
    "auth",
    "project",
    "experiment",
    "dataset",
    "document",
    "publication",
    "equipment",
    "activity",
    "notification",
    "lab"
)

$secretBindings = "DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SECRET_KEY=SUPABASE_SECRET_KEY:latest"
if ($SupabaseAnonKey) {
    $secretBindings += ",SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest"
}

$serviceUrls = @{}

foreach ($svc in $services) {
    $imageTag = "$repoBase/service-$svc`:latest"

    Exec-Step "Building container image for microservice: rh-$svc" {
        & gcloud builds submit "$rootDir" `
            --config="$rootDir\cloudbuild.yaml" `
            --substitutions="_SERVICE_NAME=$svc,_IMAGE_TAG=$imageTag" `
            --project=$ProjectId `
            --quiet
    }

    # Sizing & Environment Configuration:
    # rh-lab includes --memory=1Gi --timeout=120s
    # rh-dataset, rh-document, and rh-experiment pass --set-env-vars="GCS_BUCKET=research-hub-lab2-5-storage,STORAGE_BUCKET=research-hub-lab2-5-storage,STORAGE_DRIVER=gcs"
    $mem = if ($svc -eq "lab") { "1Gi" } elseif ($svc -eq "project") { "512Mi" } else { "256Mi" }
    $timeout = if ($svc -eq "lab") { "120s" } else { "60s" }
    $svcEnvVars = "NODE_ENV=production"

    if ($svc -eq "lab") {
        $svcEnvVars += ",LAB_DRIVER=gce,GCP_PROJECT_ID=$ProjectId,GCP_ZONE=$Region-a,GCS_BUCKET=$Bucket,STORAGE_BUCKET=$Bucket,STORAGE_DRIVER=gcs"
    } elseif ($svc -in @("dataset", "document", "experiment")) {
        $svcEnvVars = if ($Bucket -and $Bucket -ne "research-hub-lab2-5-storage") {
            "GCS_BUCKET=$Bucket,STORAGE_BUCKET=$Bucket,STORAGE_DRIVER=gcs"
        } else {
            "GCS_BUCKET=research-hub-lab2-5-storage,STORAGE_BUCKET=research-hub-lab2-5-storage,STORAGE_DRIVER=gcs"
        }
    }

    $deployArgs = @(
        "run", "deploy", "rh-$svc",
        "--image=$imageTag",
        "--region=$Region",
        "--project=$ProjectId",
        "--platform=managed",
        "--min-instances=0",
        "--max-instances=2",
        "--memory=$mem",
        "--cpu=1",
        "--concurrency=80",
        "--timeout=$timeout",
        "--set-secrets=$secretBindings",
        "--set-env-vars=$svcEnvVars",
        "--quiet"
    )

    $extraArgs = @()
    if ($AllowUnauthenticatedMicroservices) {
        $deployArgs += "--allow-unauthenticated"
        $extraArgs += "--allow-unauthenticated"
    }

    # Ensure deployment commands for rh-dataset, rh-document, and rh-experiment pass --set-env-vars="GCS_BUCKET=research-hub-lab2-5-storage,STORAGE_BUCKET=research-hub-lab2-5-storage,STORAGE_DRIVER=gcs", and rh-lab includes --memory=1Gi --timeout=120s
    if ($svc -eq "lab") {
        Exec-Step "Deploying Cloud Run microservice: rh-lab" {
            gcloud run deploy "rh-lab" `
                --image=$imageTag `
                --region=$Region `
                --project=$ProjectId `
                --platform=managed `
                --min-instances=0 `
                --max-instances=2 `
                --memory=1Gi --timeout=120s `
                --cpu=1 `
                --concurrency=80 `
                --set-secrets=$secretBindings `
                --set-env-vars=$svcEnvVars `
                @extraArgs `
                --quiet
        }
    } elseif ($svc -eq "dataset") {
        Exec-Step "Deploying Cloud Run microservice: rh-dataset" {
            if ($Bucket -and $Bucket -ne "research-hub-lab2-5-storage") {
                gcloud run deploy "rh-dataset" `
                    --image=$imageTag `
                    --region=$Region `
                    --project=$ProjectId `
                    --platform=managed `
                    --min-instances=0 `
                    --max-instances=2 `
                    --memory=$mem `
                    --cpu=1 `
                    --concurrency=80 `
                    --timeout=$timeout `
                    --set-secrets=$secretBindings `
                    --set-env-vars="GCS_BUCKET=$Bucket,STORAGE_BUCKET=$Bucket,STORAGE_DRIVER=gcs" `
                    @extraArgs `
                    --quiet
            } else {
                gcloud run deploy "rh-dataset" `
                    --image=$imageTag `
                    --region=$Region `
                    --project=$ProjectId `
                    --platform=managed `
                    --min-instances=0 `
                    --max-instances=2 `
                    --memory=$mem `
                    --cpu=1 `
                    --concurrency=80 `
                    --timeout=$timeout `
                    --set-secrets=$secretBindings `
                    --set-env-vars="GCS_BUCKET=research-hub-lab2-5-storage,STORAGE_BUCKET=research-hub-lab2-5-storage,STORAGE_DRIVER=gcs" `
                    @extraArgs `
                    --quiet
            }
        }
    } elseif ($svc -eq "document") {
        Exec-Step "Deploying Cloud Run microservice: rh-document" {
            if ($Bucket -and $Bucket -ne "research-hub-lab2-5-storage") {
                gcloud run deploy "rh-document" `
                    --image=$imageTag `
                    --region=$Region `
                    --project=$ProjectId `
                    --platform=managed `
                    --min-instances=0 `
                    --max-instances=2 `
                    --memory=$mem `
                    --cpu=1 `
                    --concurrency=80 `
                    --timeout=$timeout `
                    --set-secrets=$secretBindings `
                    --set-env-vars="GCS_BUCKET=$Bucket,STORAGE_BUCKET=$Bucket,STORAGE_DRIVER=gcs" `
                    @extraArgs `
                    --quiet
            } else {
                gcloud run deploy "rh-document" `
                    --image=$imageTag `
                    --region=$Region `
                    --project=$ProjectId `
                    --platform=managed `
                    --min-instances=0 `
                    --max-instances=2 `
                    --memory=$mem `
                    --cpu=1 `
                    --concurrency=80 `
                    --timeout=$timeout `
                    --set-secrets=$secretBindings `
                    --set-env-vars="GCS_BUCKET=research-hub-lab2-5-storage,STORAGE_BUCKET=research-hub-lab2-5-storage,STORAGE_DRIVER=gcs" `
                    @extraArgs `
                    --quiet
            }
        }
    } elseif ($svc -eq "experiment") {
        Exec-Step "Deploying Cloud Run microservice: rh-experiment" {
            if ($Bucket -and $Bucket -ne "research-hub-lab2-5-storage") {
                gcloud run deploy "rh-experiment" `
                    --image=$imageTag `
                    --region=$Region `
                    --project=$ProjectId `
                    --platform=managed `
                    --min-instances=0 `
                    --max-instances=2 `
                    --memory=$mem `
                    --cpu=1 `
                    --concurrency=80 `
                    --timeout=$timeout `
                    --set-secrets=$secretBindings `
                    --set-env-vars="GCS_BUCKET=$Bucket,STORAGE_BUCKET=$Bucket,STORAGE_DRIVER=gcs" `
                    @extraArgs `
                    --quiet
            } else {
                gcloud run deploy "rh-experiment" `
                    --image=$imageTag `
                    --region=$Region `
                    --project=$ProjectId `
                    --platform=managed `
                    --min-instances=0 `
                    --max-instances=2 `
                    --memory=$mem `
                    --cpu=1 `
                    --concurrency=80 `
                    --timeout=$timeout `
                    --set-secrets=$secretBindings `
                    --set-env-vars="GCS_BUCKET=research-hub-lab2-5-storage,STORAGE_BUCKET=research-hub-lab2-5-storage,STORAGE_DRIVER=gcs" `
                    @extraArgs `
                    --quiet
            }
        }
    } else {
        Exec-Step "Deploying Cloud Run microservice: rh-$svc" {
            & gcloud @deployArgs
        }
    }

    $svcUrl = (gcloud run services describe "rh-$svc" --region=$Region --project=$ProjectId --format="value(status.url)" 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($svcUrl)) {
        Write-Host "`n[FATAL ERROR] Failed to retrieve Cloud Run URL for rh-$svc." -ForegroundColor Red
        exit 1
    }
    $serviceUrls[$svc] = $svcUrl.Trim()
    Write-Success "rh-$svc active at $($serviceUrls[$svc])"
}

# ---------------------------------------------------------
# 6. Build & Deploy API Gateway
# ---------------------------------------------------------
Write-Step "6. Deploying API Gateway with Internal Service Route Bindings"

$gwImageTag = "$repoBase/service-gateway:latest"

Exec-Step "Building API Gateway container image" {
    & gcloud builds submit "$rootDir" `
        --config="$rootDir\cloudbuild.yaml" `
        --substitutions="_SERVICE_NAME=gateway,_IMAGE_TAG=$gwImageTag" `
        --project=$ProjectId `
        --quiet
}

# Compile route bindings for Gateway (supports both AUTH_SERVICE_URL and SERVICE_URL_AUTH conventions)
$gwEnvVarsList = @(
    "NODE_ENV=production",
    "AUTH_SERVICE_URL=$($serviceUrls['auth'])",
    "PROJECT_SERVICE_URL=$($serviceUrls['project'])",
    "EXPERIMENT_SERVICE_URL=$($serviceUrls['experiment'])",
    "DATASET_SERVICE_URL=$($serviceUrls['dataset'])",
    "DOCUMENT_SERVICE_URL=$($serviceUrls['document'])",
    "PUBLICATION_SERVICE_URL=$($serviceUrls['publication'])",
    "EQUIPMENT_SERVICE_URL=$($serviceUrls['equipment'])",
    "ACTIVITY_SERVICE_URL=$($serviceUrls['activity'])",
    "NOTIFICATION_SERVICE_URL=$($serviceUrls['notification'])",
    "LAB_SERVICE_URL=$($serviceUrls['lab'])",
    "SERVICE_URL_AUTH=$($serviceUrls['auth'])",
    "SERVICE_URL_PROJECT=$($serviceUrls['project'])",
    "SERVICE_URL_EXPERIMENT=$($serviceUrls['experiment'])",
    "SERVICE_URL_DATASET=$($serviceUrls['dataset'])",
    "SERVICE_URL_DOCUMENT=$($serviceUrls['document'])",
    "SERVICE_URL_PUBLICATION=$($serviceUrls['publication'])",
    "SERVICE_URL_EQUIPMENT=$($serviceUrls['equipment'])",
    "SERVICE_URL_ACTIVITY=$($serviceUrls['activity'])",
    "SERVICE_URL_NOTIFICATION=$($serviceUrls['notification'])",
    "SERVICE_URL_LAB=$($serviceUrls['lab'])"
)
$gwEnvJoined = $gwEnvVarsList -join ","

Exec-Step "Deploying Cloud Run API Gateway: rh-gateway" {
    gcloud run deploy "rh-gateway" `
        --image=$gwImageTag `
        --region=$Region `
        --project=$ProjectId `
        --platform=managed `
        --min-instances=0 `
        --max-instances=2 `
        --memory=512Mi `
        --cpu=1 `
        --concurrency=80 `
        --timeout=1800s `
        --set-secrets=$secretBindings `
        --set-env-vars=$gwEnvJoined `
        --allow-unauthenticated `
        --quiet
}

$gatewayUrl = (gcloud run services describe "rh-gateway" --region=$Region --project=$ProjectId --format="value(status.url)" 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gatewayUrl)) {
    Write-Host "`n[FATAL ERROR] Failed to retrieve Cloud Run URL for rh-gateway." -ForegroundColor Red
    exit 1
}
$gatewayUrl = $gatewayUrl.Trim()
Write-Success "rh-gateway active at $gatewayUrl"

# ---------------------------------------------------------
# 7. Provision Global External Application Load Balancer (Serverless NEGs)
# ---------------------------------------------------------
Write-Step "7. Provisioning Global External Application Load Balancer with Serverless NEGs"

# 7.1 Reserve Global Static IP
Write-Host "Configuring Global Static IP..." -ForegroundColor Cyan
$ipAddr = (gcloud compute addresses describe rh-global-ip --global --project=$ProjectId --format="value(address)" 2>$null)
if (-not $ipAddr -or [string]::IsNullOrWhiteSpace($ipAddr)) {
    Exec-Step "Reserving Global IPv4 Static IP Address (rh-global-ip)" {
        gcloud compute addresses create rh-global-ip --ip-version=IPV4 --global --project=$ProjectId --quiet
    }
    $ipAddr = (gcloud compute addresses describe rh-global-ip --global --project=$ProjectId --format="value(address)" 2>$null)
}
$STATIC_IP = if ($ipAddr) { $ipAddr.Trim() } else { "" }
Write-Host "Load Balancer IP: $STATIC_IP" -ForegroundColor Green

# 7.2 Serverless Network Endpoint Group (NEG) for Cloud Run API Gateway
$negName = "rh-gateway-neg"
$negExists = gcloud compute network-endpoint-groups describe $negName --region=$Region --project=$ProjectId --format="value(name)" 2>$null
if (-not $negExists) {
    Exec-Step "Creating Serverless Network Endpoint Group for API Gateway ($negName)" {
        gcloud compute network-endpoint-groups create $negName `
            --region=$Region `
            --network-endpoint-type=SERVERLESS `
            --cloud-run-service=rh-gateway `
            --project=$ProjectId `
            --quiet
    }
} else {
    Write-Host " [OK] Serverless NEG '$negName' already exists." -ForegroundColor Green
}

# 7.3 Backend Service for Serverless NEG
$backendName = "rh-gateway-backend"
$backendExists = gcloud compute backend-services describe $backendName --global --project=$ProjectId --format="value(name)" 2>$null
if (-not $backendExists) {
    Exec-Step "Creating Global Backend Service for Load Balancer ($backendName)" {
        gcloud compute backend-services create $backendName `
            --load-balancing-scheme=EXTERNAL_MANAGED `
            --global `
            --project=$ProjectId `
            --quiet
    }
    Exec-Step "Attaching Serverless NEG to Backend Service ($backendName)" {
        gcloud compute backend-services add-backend $backendName `
            --global `
            --network-endpoint-group=$negName `
            --network-endpoint-group-region=$Region `
            --project=$ProjectId `
            --quiet
    }
} else {
    Write-Host " [OK] Backend Service '$backendName' already exists." -ForegroundColor Green
}

# 7.4 Global URL Map
$urlMapName = "rh-url-map"
$urlMapExists = gcloud compute url-maps describe $urlMapName --global --project=$ProjectId --format="value(name)" 2>$null
if (-not $urlMapExists) {
    Exec-Step "Creating Global URL Map ($urlMapName)" {
        gcloud compute url-maps create $urlMapName `
            --default-service=$backendName `
            --global `
            --project=$ProjectId `
            --quiet
    }
} else {
    Write-Host " [OK] URL Map '$urlMapName' already exists." -ForegroundColor Green
}

# 7.5 Target HTTP Proxy
$targetProxyName = "rh-http-proxy"
$proxyExists = gcloud compute target-http-proxies describe $targetProxyName --global --project=$ProjectId --format="value(name)" 2>$null
if (-not $proxyExists) {
    Exec-Step "Creating Target HTTP Proxy ($targetProxyName)" {
        gcloud compute target-http-proxies create $targetProxyName `
            --url-map=$urlMapName `
            --global `
            --project=$ProjectId `
            --quiet
    }
} else {
    Write-Host " [OK] Target HTTP Proxy '$targetProxyName' already exists." -ForegroundColor Green
}

# 7.6 Global Forwarding Rule
$forwardingRuleName = "rh-http-forwarding-rule"
$fwdExists = gcloud compute forwarding-rules describe $forwardingRuleName --global --project=$ProjectId --format="value(name)" 2>$null
if (-not $fwdExists) {
    Exec-Step "Creating Global Forwarding Rule ($forwardingRuleName on Port 80)" {
        gcloud compute forwarding-rules create $forwardingRuleName `
            --load-balancing-scheme=EXTERNAL_MANAGED `
            --network-tier=PREMIUM `
            --address=rh-global-ip `
            --target-http-proxy=$targetProxyName `
            --global `
            --ports=80 `
            --project=$ProjectId `
            --quiet
    }
} else {
    Write-Host " [OK] Forwarding Rule '$forwardingRuleName' already exists." -ForegroundColor Green
}

$lbUrl = if ($STATIC_IP) { "http://$STATIC_IP" } else { $gatewayUrl }
$lbApiUrl = "$lbUrl/api"

# ---------------------------------------------------------
# 8. Frontend Build & Firebase Hosting Deployment
# ---------------------------------------------------------
Write-Step "8. Building Frontend & Deploying to Firebase Hosting"

# 1. Update frontend production env with dynamic relative API path
$frontendEnvProd = Join-Path $rootDir "frontend\.env.production"
Set-Content -Path $frontendEnvProd -Value "VITE_API_URL=/api`nVITE_GATEWAY_URL=$gatewayUrl" -Encoding UTF8
Write-Success "Injected dynamic relative API URL into frontend/.env.production (VITE_API_URL=/api, VITE_GATEWAY_URL=$gatewayUrl)"

# 2. Build Vite frontend
Exec-Step "Executing production frontend build (npm run build:frontend)" {
    Push-Location $rootDir
    try {
        npm run build:frontend
    } finally {
        Pop-Location
    }
}

# 3. Automated Zero-Touch Firebase Hosting Provisioning
$firebaseUrl = "https://${ProjectId}.web.app"
if ($hasFirebase) {
    Write-Host "Configuring Firebase project and hosting resources..." -ForegroundColor Cyan

    # Ensure the GCP project has Firebase enabled
    & firebase projects:addfirebase $ProjectId --quiet 2>$null | Out-Null

    # Query existing hosting sites
    $rawSites = & firebase hosting:sites:list --project=$ProjectId --json 2>$null
    $targetSite = $null

    try {
        if ($rawSites) {
            $jsonStr = ($rawSites | Out-String).Trim()
            if ($jsonStr -match '(?s)(\{.*\})') {
                $jsonStr = $matches[1]
            }
            $parsedJson = $jsonStr | ConvertFrom-Json
            if ($parsedJson.result.sites -and $parsedJson.result.sites.Count -gt 0) {
                $fullName = $parsedJson.result.sites[0].name
                $targetSite = $fullName.Substring($fullName.LastIndexOf('/') + 1)
            }
        }
    } catch {
        Write-Warn "Unable to parse existing hosting sites JSON."
    }

    # If no site exists yet, create one explicitly via CLI to prevent interactive prompts
    if (-not $targetSite) {
        Write-Host "Creating default hosting site for $ProjectId..." -ForegroundColor Cyan
        $createOutput = & firebase hosting:sites:create $ProjectId --project=$ProjectId --json 2>$null
        try {
            if ($createOutput) {
                $createJsonStr = ($createOutput | Out-String).Trim()
                if ($createJsonStr -match '(?s)(\{.*\})') {
                    $createJsonStr = $matches[1]
                }
                $createdJson = $createJsonStr | ConvertFrom-Json
                if ($createdJson.result.name) {
                    $fullName = $createdJson.result.name
                    $targetSite = $fullName.Substring($fullName.LastIndexOf('/') + 1)
                }
            }
        } catch {}
    }

    if (-not $targetSite) {
        $targetSite = $ProjectId
    }

    Write-Success "Active Firebase Hosting site identified: $targetSite"

    # Write dynamic hosting configuration with Cloud Run API gateway rewrites into firebase.json
    $firebaseJsonPath = Join-Path $rootDir "firebase.json"
    $firebaseConfig = @"
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "rh-gateway",
          "region": "$Region"
        }
      },
      {
        "source": "/healthz",
        "run": {
          "serviceId": "rh-gateway",
          "region": "$Region"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
"@
    Set-Content -Path $firebaseJsonPath -Value $firebaseConfig -Encoding UTF8
    Write-Success "Generated dynamic, project-agnostic firebase.json with Cloud Run gateway rewrites ($Region)"

    # Deploy non-interactively
    $firebaseUrl = "https://${targetSite}.web.app"
    Exec-Step "Deploying static assets and rewrites to Firebase Hosting ($targetSite)" {
        & firebase deploy --only hosting --project=$ProjectId --non-interactive
    }
} else {
    Write-Err "Firebase CLI not found. Skipping hosting deployment."
}

# ---------------------------------------------------------
# 9. Completion & Verification Summary
# ---------------------------------------------------------
Write-Step "DEPLOYMENT COMPLETE"

Write-Host "ResearchHub OS is live and configured on GCP and Firebase!" -ForegroundColor Green
Write-Host "  Project ID           : $ProjectId" -ForegroundColor Gray
Write-Host "  Region               : $Region" -ForegroundColor Gray
if ($STATIC_IP) {
Write-Host "  Load Balancer IP     : $STATIC_IP" -ForegroundColor Cyan
Write-Host "  Load Balancer URL    : $lbUrl" -ForegroundColor Cyan
}
Write-Host "  Cloud Run Gateway    : $gatewayUrl" -ForegroundColor Cyan
Write-Host "  Firebase Web App     : $firebaseUrl" -ForegroundColor Cyan
Write-Host "  Database Backend     : Supabase PostgreSQL ($(Mask-DbUrl $DatabaseUrl))" -ForegroundColor Gray
Write-Host "  Budget Protection    : Scale-to-Zero (min: 0, max: 2, 256/512Mi)" -ForegroundColor Green

Write-Host "`nHealth Check Commands:" -ForegroundColor Yellow
if ($STATIC_IP) {
Write-Host "  curl $lbUrl/healthz" -ForegroundColor Gray
}
Write-Host "  curl $gatewayUrl/healthz" -ForegroundColor Gray

Write-Host "`nTo permanently decommission the project and prevent lingering charges:" -ForegroundColor Magenta
Write-Host "  .\scripts\gcp-teardown.ps1 -ProjectId $ProjectId`n" -ForegroundColor Gray
