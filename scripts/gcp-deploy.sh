#!/usr/bin/env bash
# =============================================================================
# ResearchHub OS — gcp-deploy.sh
# Automated GCP Secret Manager, Cloud Run (Scale-to-Zero), Supabase & Firebase Deployment
# Equipped with strict fail-fast error handling and billing guards.
# =============================================================================
set -euo pipefail

REGION="${REGION:-us-central1}"
PROJECT_ID=""
BILLING_ACCOUNT_ID=""
SECRETS_FILE=""
ALLOW_UNAUTHENTICATED_MICROSERVICES=true

log()  { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m [OK] \033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m [WARN] \033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m [ERROR] \033[0m %s\n' "$*" >&2; exit 1; }

exec_step() {
  local description="$1"; shift
  printf '\n\033[1;36m==> %s\033[0m\n' "$description"
  if ! "$@"; then
    local code=$?
    printf '\n\033[1;31m[FATAL ERROR] Step failed: %s (Exit code: %d)\033[0m\n' "$description" "$code" >&2
    printf '\033[1;31mAborting deployment to prevent invalid state.\033[0m\n' >&2
    exit "$code"
  fi
  printf ' \033[1;32m[OK]\033[0m %s completed.\n' "$description"
}

mask_url() {
  local raw="$1"
  if [ -z "$raw" ]; then echo ""; return; fi
  echo "$raw" | sed -E 's|://([^:]+):(.+)@([^@]+)$|://\1:****@\3|'
}

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project|--project-id) PROJECT_ID="$2"; shift 2 ;;
    --billing|--billing-account) BILLING_ACCOUNT_ID="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --secrets-file) SECRETS_FILE="$2"; shift 2 ;;
    --allow-unauth-microservices) ALLOW_UNAUTHENTICATED_MICROSERVICES=true; shift ;;
    -h|--help)
      echo "Usage: ./scripts/gcp-deploy.sh [--project ID] [--billing ACCOUNT_ID] [--region REGION] [--secrets-file PATH]"
      exit 0
      ;;
    *) err "Unknown argument: $1" ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------
# 0. Pre-requisites Check
# ---------------------------------------------------------
log "Step 0: Checking Pre-requisites & Authentication..."
command -v gcloud >/dev/null 2>&1 || err "'gcloud' CLI is required. Install from: https://cloud.google.com/sdk/docs/install"
command -v node >/dev/null 2>&1 || err "Node.js ('node') is required."
command -v npm >/dev/null 2>&1 || err "'npm' is required."

ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ] || [ "$ACTIVE_ACCOUNT" = "(unset)" ]; then
  err "No active Google Cloud account detected. Please run: gcloud auth login"
fi
ok "Authenticated as GCP user: $ACTIVE_ACCOUNT"

HAS_FIREBASE=false
if command -v firebase >/dev/null 2>&1; then
  HAS_FIREBASE=true
else
  warn "Firebase CLI not found in PATH. Install via 'npm install -g firebase-tools'."
fi

# Project ID resolution
if [ -z "$PROJECT_ID" ]; then
  CURRENT_PROJ=$(gcloud config get-value project 2>/dev/null || true)
  if [ -n "$CURRENT_PROJ" ] && [ "$CURRENT_PROJ" != "(unset)" ]; then
    DEFAULT_ID="$CURRENT_PROJ"
  else
    DEFAULT_ID="researchhub-os-$RANDOM"
  fi
  read -r -p "Enter GCP Project ID [default: $DEFAULT_ID]: " INPUT_ID
  PROJECT_ID="${INPUT_ID:-$DEFAULT_ID}"
fi
PROJECT_ID=$(echo "$PROJECT_ID" | tr '[:upper:]' '[:lower:]' | xargs)

# Billing Account resolution
if [ -z "$BILLING_ACCOUNT_ID" ]; then
  echo "Listing available billing accounts:"
  gcloud billing accounts list || true
  read -r -p "Enter GCP Billing Account ID (e.g. 012345-6789AB-CDEF01): " BILLING_ACCOUNT_ID
  [ -z "$BILLING_ACCOUNT_ID" ] && err "Billing Account ID is required."
fi

# Billing Account Guard: verify billing account is active/open
BILLING_OPEN=$(gcloud billing accounts describe "$BILLING_ACCOUNT_ID" --format="value(open)" 2>/dev/null || true)
if [ "$BILLING_OPEN" = "False" ] || [ "$BILLING_OPEN" = "false" ]; then
  err "Billing account '$BILLING_ACCOUNT_ID' is CLOSED. Please provide an active billing account."
fi

# ---------------------------------------------------------
# 1. Secret Ingestion & Secret Manager Automation
# ---------------------------------------------------------
log "Step 1: Detecting and Parsing Secrets..."

DETECTED_FILE=""
if [ -n "$SECRETS_FILE" ] && [ -f "$SECRETS_FILE" ]; then
  DETECTED_FILE="$SECRETS_FILE"
else
  CANDIDATES=("secrets.env" ".env.secrets" "secretes.txt" "secrets.txt" ".env.production" ".env")
  for cand in "${CANDIDATES[@]}"; do
    if [ -f "$ROOT_DIR/$cand" ]; then
      DETECTED_FILE="$ROOT_DIR/$cand"
      break
    fi
  done
fi

[ -z "$DETECTED_FILE" ] && err "No secrets file detected. Please create 'secrets.env' or '.env.secrets' with your Supabase credentials."
ok "Detected secrets configuration: $(basename "$DETECTED_FILE")"

DATABASE_URL=""
SUPABASE_URL=""
SUPABASE_ANON_KEY=""
SUPABASE_SECRET_KEY=""
JWT_SECRET=""

# Parse line by line without echoing values
while IFS= read -r line || [ -n "$line" ]; do
  trimmed=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ -z "$trimmed" ] && continue
  [[ "$trimmed" =~ ^# ]] && continue

  if [[ "$trimmed" =~ ^postgres(ql)?:// ]]; then
    DATABASE_URL="$trimmed"
    continue
  fi

  if [[ "$trimmed" =~ ^DATABASE_URL= ]]; then
    DATABASE_URL="${trimmed#DATABASE_URL=}"
    DATABASE_URL=$(echo "$DATABASE_URL" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  elif [[ "$trimmed" =~ ^SUPABASE_URL= ]]; then
    SUPABASE_URL="${trimmed#SUPABASE_URL=}"
    SUPABASE_URL=$(echo "$SUPABASE_URL" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  elif [[ "$trimmed" =~ ^SUPABASE_ANON_KEY= ]]; then
    SUPABASE_ANON_KEY="${trimmed#SUPABASE_ANON_KEY=}"
    SUPABASE_ANON_KEY=$(echo "$SUPABASE_ANON_KEY" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  elif [[ "$trimmed" =~ ^SUPABASE_PUBLISHABLE_KEY= ]]; then
    [ -z "$SUPABASE_ANON_KEY" ] && SUPABASE_ANON_KEY="${trimmed#SUPABASE_PUBLISHABLE_KEY=}"
    SUPABASE_ANON_KEY=$(echo "$SUPABASE_ANON_KEY" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  elif [[ "$trimmed" =~ ^SUPABASE_SECRET_KEY= ]]; then
    SUPABASE_SECRET_KEY="${trimmed#SUPABASE_SECRET_KEY=}"
    SUPABASE_SECRET_KEY=$(echo "$SUPABASE_SECRET_KEY" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  elif [[ "$trimmed" =~ ^SUPABASE_SERVICE_ROLE_KEY= ]]; then
    [ -z "$SUPABASE_SECRET_KEY" ] && SUPABASE_SECRET_KEY="${trimmed#SUPABASE_SERVICE_ROLE_KEY=}"
    SUPABASE_SECRET_KEY=$(echo "$SUPABASE_SECRET_KEY" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  elif [[ "$trimmed" =~ ^JWT_SECRET= ]]; then
    JWT_SECRET="${trimmed#JWT_SECRET=}"
    JWT_SECRET=$(echo "$JWT_SECRET" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  fi
done < "$DETECTED_FILE"

[ -z "$DATABASE_URL" ] && err "DATABASE_URL is missing in $DETECTED_FILE"

if [ -z "$SUPABASE_URL" ]; then
  if [[ "$DATABASE_URL" =~ @db\.([a-z0-9]+)\.supabase\.co ]]; then
    PROJECT_REF="${BASH_REMATCH[1]}"
    SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
  else
    err "SUPABASE_URL is missing in $DETECTED_FILE"
  fi
fi

[ -z "$SUPABASE_SECRET_KEY" ] && err "SUPABASE_SECRET_KEY is missing in $DETECTED_FILE"

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || od -vN 32 -An -tx1 /dev/urandom | tr -d ' \n')
  log "Generated secure 64-char hex JWT_SECRET."
fi

log "Secrets loaded safely:"
log "  Database Target : $(mask_url "$DATABASE_URL")"
log "  Supabase URL    : $SUPABASE_URL"
log "  Supabase Secret : configured (${#SUPABASE_SECRET_KEY} chars)"
log "  JWT Secret      : configured (${#JWT_SECRET} chars)"

# ---------------------------------------------------------
# 2. GCP Project, Billing Guards & API Enablement
# ---------------------------------------------------------
log "Step 2: Configuring GCP Project & APIs (Billing Guards)..."

if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  warn "Project '$PROJECT_ID' already exists. Using active project."
else
  exec_step "Creating GCP Project: $PROJECT_ID" \
    gcloud projects create "$PROJECT_ID" --name="ResearchHub OS" --quiet
fi

exec_step "Setting active gcloud project to $PROJECT_ID" \
  gcloud config set project "$PROJECT_ID" --quiet

exec_step "Setting default Cloud Run region to $REGION" \
  gcloud config set run/region "$REGION" --quiet

exec_step "Linking billing account ($BILLING_ACCOUNT_ID) to project $PROJECT_ID" \
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID" --quiet

# Strict Billing Guard Verification
BILLING_STATUS=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || true)
if [ "$BILLING_STATUS" != "True" ] && [ "$BILLING_STATUS" != "true" ]; then
  printf '\n\033[1;31m[FATAL ERROR] Billing verification failed: Project %s does not have billingEnabled=true.\033[0m\n' "$PROJECT_ID" >&2
  printf '\033[1;31mAborting deployment to prevent invalid state.\033[0m\n' >&2
  exit 1
fi
ok "Billing guard verified: Project '$PROJECT_ID' has active billing linkage (billingEnabled: true)."

exec_step "Enabling Google Cloud APIs" \
  gcloud services enable \
    compute.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    storage.googleapis.com \
    firebase.googleapis.com \
    firebasehosting.googleapis.com \
    --project="$PROJECT_ID" --quiet

# ---------------------------------------------------------
# 3. Secret Manager Provisioning & IAM Binding
# ---------------------------------------------------------
log "Step 3: Provisioning Secret Manager & IAM Access..."

provision_secret() {
  local key="$1"
  local val="$2"
  if ! gcloud secrets describe "$key" --project="$PROJECT_ID" >/dev/null 2>&1; then
    exec_step "Creating secret resource: $key" \
      gcloud secrets create "$key" --replication-policy="automatic" --project="$PROJECT_ID" --quiet
  fi
  printf '%s' "$val" | gcloud secrets versions add "$key" --data-file=- --project="$PROJECT_ID" --quiet
  local pipe_exit=$?
  if [ $pipe_exit -ne 0 ]; then
    printf '\n\033[1;31m[FATAL ERROR] Failed to publish secret version for %s (Exit code: %d)\033[0m\n' "$key" "$pipe_exit" >&2
    exit "$pipe_exit"
  fi
  ok "Secret '$key' published securely via stdin."
}

provision_secret "DATABASE_URL" "$DATABASE_URL"
provision_secret "JWT_SECRET" "$JWT_SECRET"
provision_secret "SUPABASE_URL" "$SUPABASE_URL"
provision_secret "SUPABASE_SECRET_KEY" "$SUPABASE_SECRET_KEY"
if [ -n "$SUPABASE_ANON_KEY" ]; then
  provision_secret "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" | tr -d '[:space:]')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

exec_step "Binding Secret Accessor IAM role to compute service account ($COMPUTE_SA)" \
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet

exec_step "Binding Compute Instance Admin IAM role to compute service account for on-demand lab worker provisioning" \
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/compute.instanceAdmin.v1" \
    --quiet

exec_step "Binding Service Account User IAM role to compute service account" \
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/iam.serviceAccountUser" \
    --quiet

# Ensure Compute Engine firewall rule for lab workers (ports 8888 & 80)
if ! gcloud compute firewall-rules describe allow-researchhub-lab --project="$PROJECT_ID" >/dev/null 2>&1; then
  exec_step "Creating Compute Engine firewall rule for ResearchHub Lab workers (port 8888 & 80)" \
    gcloud compute firewall-rules create allow-researchhub-lab \
      --allow=tcp:8888,tcp:80 \
      --target-tags=researchhub-lab,http-server \
      --description="Allow direct access to ephemeral lab JupyterLab workers" \
      --project="$PROJECT_ID" \
      --quiet
fi

# ---------------------------------------------------------
# 4. Supabase Schema Migration & Verification
# ---------------------------------------------------------
log "Step 4: Running Supabase Migrations & Seeds..."
exec_step "Executing Supabase database migrations and seeds (scripts/db-init.js)" \
  node "$SCRIPT_DIR/db-init.js" "$DATABASE_URL"

# ---------------------------------------------------------
# 5. Build & Deploy Microservices (Scale-to-Zero)
# ---------------------------------------------------------
log "Step 5: Deploying Microservices to Cloud Run..."
REPO_NAME="researchhub-repo"
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  exec_step "Creating Artifact Registry repository: $REPO_NAME" \
    gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker --location="$REGION" --project="$PROJECT_ID" --quiet
fi

REPO_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

SERVICES=("auth" "project" "experiment" "dataset" "document" "publication" "equipment" "activity" "notification" "lab")
declare -A SERVICE_URLS

SECRET_BINDINGS="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SECRET_KEY=SUPABASE_SECRET_KEY:latest"
if [ -n "$SUPABASE_ANON_KEY" ]; then
  SECRET_BINDINGS="${SECRET_BINDINGS},SUPABASE_ANON_KEY=SUPABASE_ANON_KEY:latest"
fi

for svc in "${SERVICES[@]}"; do
  TAG="${REPO_BASE}/service-${svc}:latest"
  exec_step "Building container image for rh-$svc via Cloud Build" \
    gcloud builds submit "$ROOT_DIR" \
      --config="$ROOT_DIR/cloudbuild.yaml" \
      --substitutions="_SERVICE_NAME=$svc,_IMAGE_TAG=$TAG" \
      --project="$PROJECT_ID" --quiet

  # Sizing: 1Gi for lab (due to @google-cloud/compute gRPC overhead), 512Mi for project, 256Mi for lightweight services
  MEM="256Mi"
  if [ "$svc" == "lab" ]; then
    MEM="1Gi"
  elif [ "$svc" == "project" ]; then
    MEM="512Mi"
  fi
  TIMEOUT="60s"
  [ "$svc" == "lab" ] && TIMEOUT="120s"

  ENV_VARS="NODE_ENV=production,PORT=8080"
  if [ "$svc" == "lab" ]; then
    ENV_VARS="${ENV_VARS},LAB_DRIVER=gce,GCP_PROJECT_ID=${PROJECT_ID},GCP_ZONE=${REGION}-a"
  fi

  UNAUTH_FLAG=""
  if [ "$ALLOW_UNAUTHENTICATED_MICROSERVICES" = true ]; then
    UNAUTH_FLAG="--allow-unauthenticated"
  fi

  exec_step "Deploying Cloud Run microservice: rh-$svc" \
    gcloud run deploy "rh-$svc" \
      --image "$TAG" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --platform managed \
      --min-instances 0 \
      --max-instances 2 \
      --memory "$MEM" \
      --cpu 1 \
      --concurrency 80 \
      --timeout "$TIMEOUT" \
      --set-secrets "$SECRET_BINDINGS" \
      --set-env-vars "$ENV_VARS" \
      $UNAUTH_FLAG \
      --quiet

  SVC_URL=$(gcloud run services describe "rh-$svc" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)" | tr -d '[:space:]')
  [ -z "$SVC_URL" ] && err "Failed to retrieve Cloud Run URL for rh-$svc."
  SERVICE_URLS[$svc]="$SVC_URL"
  ok "rh-$svc deployed at $SVC_URL"
done

# ---------------------------------------------------------
# 6. Build & Deploy Gateway
# ---------------------------------------------------------
log "Step 6: Deploying API Gateway..."
GW_TAG="${REPO_BASE}/service-gateway:latest"
exec_step "Building API Gateway container image via Cloud Build" \
  gcloud builds submit "$ROOT_DIR" \
    --config="$ROOT_DIR/cloudbuild.yaml" \
    --substitutions="_SERVICE_NAME=gateway,_IMAGE_TAG=$GW_TAG" \
    --project="$PROJECT_ID" --quiet

GW_ENV="NODE_ENV=production,PORT=8080"
for svc in "${SERVICES[@]}"; do
  UPPER_SVC=$(echo "$svc" | tr '[:lower:]' '[:upper:]')
  GW_ENV="${GW_ENV},${UPPER_SVC}_SERVICE_URL=${SERVICE_URLS[$svc]},SERVICE_URL_${UPPER_SVC}=${SERVICE_URLS[$svc]}"
done

exec_step "Deploying Cloud Run API Gateway: rh-gateway" \
  gcloud run deploy "rh-gateway" \
    --image "$GW_TAG" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --platform managed \
    --min-instances 0 \
    --max-instances 2 \
    --memory 512Mi \
    --cpu 1 \
    --concurrency 80 \
    --timeout 60s \
    --set-secrets "$SECRET_BINDINGS" \
    --set-env-vars "$GW_ENV" \
    --allow-unauthenticated \
    --quiet

GATEWAY_URL=$(gcloud run services describe "rh-gateway" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)" | tr -d '[:space:]')
[ -z "$GATEWAY_URL" ] && err "Failed to retrieve Cloud Run URL for rh-gateway."
ok "rh-gateway deployed at $GATEWAY_URL"

# ---------------------------------------------------------
# 7. Provision Global External Application Load Balancer (Serverless NEGs)
# ---------------------------------------------------------
log "Step 7: Provisioning Global External Application Load Balancer with Serverless NEGs..."

# 7.1 Reserve Global Static IP
log "Configuring Global Static IP..."
STATIC_IP=$(gcloud compute addresses describe rh-global-ip --global --project="$PROJECT_ID" --format="value(address)" 2>/dev/null || true)
if [ -z "$STATIC_IP" ]; then
  exec_step "Reserving Global IPv4 Static IP Address (rh-global-ip)" \
    gcloud compute addresses create rh-global-ip --ip-version=IPV4 --global --project="$PROJECT_ID" --quiet
  STATIC_IP=$(gcloud compute addresses describe rh-global-ip --global --project="$PROJECT_ID" --format="value(address)" 2>/dev/null || true)
fi
ok "Load Balancer IP: $STATIC_IP"

# 7.2 Serverless NEG for Cloud Run API Gateway
NEG_NAME="rh-gateway-neg"
if ! gcloud compute network-endpoint-groups describe "$NEG_NAME" --region="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  exec_step "Creating Serverless Network Endpoint Group for API Gateway ($NEG_NAME)" \
    gcloud compute network-endpoint-groups create "$NEG_NAME" \
      --region="$REGION" \
      --network-endpoint-type=SERVERLESS \
      --cloud-run-service=rh-gateway \
      --project="$PROJECT_ID" \
      --quiet
else
  ok "Serverless NEG '$NEG_NAME' already exists."
fi

# 7.3 Backend Service for Serverless NEG
BACKEND_NAME="rh-gateway-backend"
if ! gcloud compute backend-services describe "$BACKEND_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
  exec_step "Creating Global Backend Service for Load Balancer ($BACKEND_NAME)" \
    gcloud compute backend-services create "$BACKEND_NAME" \
      --load-balancing-scheme=EXTERNAL_MANAGED \
      --global \
      --project="$PROJECT_ID" \
      --quiet
  exec_step "Attaching Serverless NEG to Backend Service ($BACKEND_NAME)" \
    gcloud compute backend-services add-backend "$BACKEND_NAME" \
      --global \
      --network-endpoint-group="$NEG_NAME" \
      --network-endpoint-group-region="$REGION" \
      --project="$PROJECT_ID" \
      --quiet
else
  ok "Backend Service '$BACKEND_NAME' already exists."
fi

# 7.4 Global URL Map
URL_MAP_NAME="rh-url-map"
if ! gcloud compute url-maps describe "$URL_MAP_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
  exec_step "Creating Global URL Map ($URL_MAP_NAME)" \
    gcloud compute url-maps create "$URL_MAP_NAME" \
      --default-service="$BACKEND_NAME" \
      --global \
      --project="$PROJECT_ID" \
      --quiet
else
  ok "URL Map '$URL_MAP_NAME' already exists."
fi

# 7.5 Target HTTP Proxy
TARGET_PROXY_NAME="rh-http-proxy"
if ! gcloud compute target-http-proxies describe "$TARGET_PROXY_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
  exec_step "Creating Target HTTP Proxy ($TARGET_PROXY_NAME)" \
    gcloud compute target-http-proxies create "$TARGET_PROXY_NAME" \
      --url-map="$URL_MAP_NAME" \
      --global \
      --project="$PROJECT_ID" \
      --quiet
else
  ok "Target HTTP Proxy '$TARGET_PROXY_NAME' already exists."
fi

# 7.6 Global Forwarding Rule
FWD_RULE_NAME="rh-http-forwarding-rule"
if ! gcloud compute forwarding-rules describe "$FWD_RULE_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
  exec_step "Creating Global Forwarding Rule ($FWD_RULE_NAME on Port 80)" \
    gcloud compute forwarding-rules create "$FWD_RULE_NAME" \
      --load-balancing-scheme=EXTERNAL_MANAGED \
      --network-tier=PREMIUM \
      --address=rh-global-ip \
      --target-http-proxy="$TARGET_PROXY_NAME" \
      --global \
      --ports=80 \
      --project="$PROJECT_ID" \
      --quiet
else
  ok "Forwarding Rule '$FWD_RULE_NAME' already exists."
fi

LB_URL="http://${STATIC_IP}"
LB_API_URL="${LB_URL}/api"
[ -z "$STATIC_IP" ] && LB_API_URL="${GATEWAY_URL}/api"

# ---------------------------------------------------------
# 8. Frontend Build & Firebase Hosting
# ---------------------------------------------------------
log "Step 8: Building Frontend & Deploying to Firebase..."
printf "VITE_API_URL=/api\nVITE_GATEWAY_URL=%s\n" "$GATEWAY_URL" > "$ROOT_DIR/frontend/.env.production"
ok "Injected dynamic relative API URL into frontend/.env.production (VITE_API_URL=/api, VITE_GATEWAY_URL=$GATEWAY_URL)"

exec_step "Building frontend production bundle" \
  bash -c "cd '$ROOT_DIR' && npm run build:frontend"

FIREBASE_URL="https://${PROJECT_ID}.web.app"
if [ "$HAS_FIREBASE" = true ]; then
  log "Configuring Firebase project and hosting resources..."
  firebase projects:addfirebase "$PROJECT_ID" --quiet >/dev/null 2>&1 || true

  RAW_SITES=$(firebase hosting:sites:list --project="$PROJECT_ID" --json 2>/dev/null || echo "{}")
  TARGET_SITE=$(node -e '
    try {
      const data = JSON.parse(process.argv[1]);
      if (data.result && data.result.sites && data.result.sites.length > 0) {
        const name = data.result.sites[0].name;
        console.log(name.substring(name.lastIndexOf("/") + 1));
      }
    } catch (e) {}
  ' "$RAW_SITES" 2>/dev/null)

  if [ -z "$TARGET_SITE" ]; then
    CREATE_OUT=$(firebase hosting:sites:create "$PROJECT_ID" --project="$PROJECT_ID" --json 2>/dev/null || echo "{}")
    TARGET_SITE=$(node -e '
      try {
        const data = JSON.parse(process.argv[1]);
        if (data.result && data.result.name) {
          const name = data.result.name;
          console.log(name.substring(name.lastIndexOf("/") + 1));
        }
      } catch (e) {}
    ' "$CREATE_OUT" 2>/dev/null)
  fi

  [ -z "$TARGET_SITE" ] && TARGET_SITE="$PROJECT_ID"
  ok "Active Firebase Hosting site identified: $TARGET_SITE"

  FIREBASE_JSON="$ROOT_DIR/firebase.json"
  cat <<EOF > "$FIREBASE_JSON"
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
          "region": "$REGION"
        }
      },
      {
        "source": "/healthz",
        "run": {
          "serviceId": "rh-gateway",
          "region": "$REGION"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF
  ok "Generated dynamic, project-agnostic firebase.json with Cloud Run gateway rewrites ($REGION)"

  FIREBASE_URL="https://${TARGET_SITE}.web.app"
  exec_step "Deploying static assets and rewrites to Firebase Hosting ($TARGET_SITE)" \
    firebase deploy --only hosting --project="$PROJECT_ID" --non-interactive
else
  err "Firebase CLI not found. Skipping hosting deployment."
fi

# ---------------------------------------------------------
# 9. Completion Summary
# ---------------------------------------------------------
log "=========================================================="
ok "DEPLOYMENT COMPLETE"
log "Project ID           : $PROJECT_ID"
if [ -n "$STATIC_IP" ]; then
log "Load Balancer IP     : $STATIC_IP"
log "Load Balancer URL    : $LB_URL"
fi
log "Cloud Run Gateway    : $GATEWAY_URL"
log "Firebase Hosting     : $FIREBASE_URL"
log "Database             : Supabase PostgreSQL"
log "Scale-to-Zero Budget : 0 to 2 instances, max 512Mi"
log "Health Checks:"
[ -n "$STATIC_IP" ] && log "  curl $LB_URL/healthz"
log "  curl $GATEWAY_URL/healthz"
log "To teardown and stop all charges:"
log "  ./scripts/gcp-teardown.sh --project $PROJECT_ID"
log "=========================================================="
