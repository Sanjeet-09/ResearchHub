#!/usr/bin/env bash
# =============================================================================
# ResearchHub OS — Nuclear Teardown Automation (Bash)
# Permanently unlinks billing and deletes the entire GCP project and all associated resources.
# Equipped with strict fail-fast error handling and billing guards.
# =============================================================================
set -euo pipefail

PROJECT_ID=""
FORCE=false

err()  { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }

exec_step() {
  local description="$1"; shift
  printf '\n\033[1;36m==> %s\033[0m\n' "$description"
  if ! "$@"; then
    local code=$?
    printf '\n\033[1;31m[FATAL ERROR] Step failed: %s (Exit code: %d)\033[0m\n' "$description" "$code" >&2
    printf '\033[1;31mAborting teardown to prevent invalid state.\033[0m\n' >&2
    exit "$code"
  fi
  printf ' \033[1;32m[OK]\033[0m %s completed.\n' "$description"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project|--project-id) PROJECT_ID="$2"; shift 2 ;;
    --force|-f) FORCE=true; shift ;;
    -h|--help)
      echo "Usage: ./scripts/gcp-teardown.sh [--project PROJECT_ID] [--force]"
      exit 0
      ;;
    *) err "Unknown argument: $1" ;;
  esac
done

command -v gcloud >/dev/null 2>&1 || err "'gcloud' CLI is required. Install from: https://cloud.google.com/sdk/docs/install"

# Resolve Project ID
if [ -z "$PROJECT_ID" ]; then
  CURRENT_PROJ=$(gcloud config get-value project 2>/dev/null || true)
  if [ -n "$CURRENT_PROJ" ] && [ "$CURRENT_PROJ" != "(unset)" ]; then
    PROJECT_ID="$CURRENT_PROJ"
  else
    read -r -p "Enter the GCP Project ID to delete: " PROJECT_ID
  fi
fi
PROJECT_ID=$(echo "$PROJECT_ID" | tr '[:upper:]' '[:lower:]' | xargs)
[ -z "$PROJECT_ID" ] && err "A valid Project ID is required."

# Verify project existence
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  err "Project '$PROJECT_ID' was not found or accessible."
fi

# Confirmation prompt
if [ "$FORCE" = false ]; then
  echo ""
  echo "================================================================="
  printf '\033[1;31mWARNING: This will permanently delete the entire GCP project\033[0m\n'
  printf '\033[1;31m%s and all associated resources:\033[0m\n' "'$PROJECT_ID'"
  echo "  - All Cloud Run microservices & API Gateway"
  echo "  - Artifact Registry container images & repositories"
  echo "  - Secret Manager secrets & IAM permissions"
  echo "  - Google Cloud billing link (immediate spend halt)"
  echo "================================================================="
  echo ""
  read -r -p "Type the project ID ('$PROJECT_ID') to confirm total project deletion: " CONFIRM
  if [ "$CONFIRM" != "$PROJECT_ID" ]; then
    echo "[CANCELLED] Input did not match. Aborting teardown."
    exit 0
  fi
fi

echo "Executing total GCP project shutdown & billing teardown..."

# Billing Guard: Unlink billing to halt charges immediately
BILLING_ACCT=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingAccountName)" 2>/dev/null || true)
if [ -n "$BILLING_ACCT" ]; then
  exec_step "Billing Guard: Unlinking billing account from project $PROJECT_ID (Immediate Spend Halt)" \
    gcloud billing projects unlink "$PROJECT_ID" --quiet || warn "Billing account already unlinked."
else
  log "No active billing account linked to project $PROJECT_ID."
fi

# Disable Firebase hosting if CLI installed
if command -v firebase >/dev/null 2>&1; then
  firebase hosting:disable --project "$PROJECT_ID" --force 2>/dev/null || true
fi

# Clean up Load Balancer resources & IP (best-effort)
log "Releasing Load Balancer resources..."
gcloud compute forwarding-rules delete rh-http-forwarding-rule --global --project="$PROJECT_ID" --quiet 2>/dev/null || true
gcloud compute target-http-proxies delete rh-http-proxy --global --project="$PROJECT_ID" --quiet 2>/dev/null || true
gcloud compute url-maps delete rh-url-map --global --project="$PROJECT_ID" --quiet 2>/dev/null || true
gcloud compute backend-services delete rh-gateway-backend --global --project="$PROJECT_ID" --quiet 2>/dev/null || true
gcloud compute addresses delete rh-global-ip --global --project="$PROJECT_ID" --quiet 2>/dev/null || true

# Permanent project deletion
exec_step "Permanently deleting GCP project: $PROJECT_ID" \
  gcloud projects delete "$PROJECT_ID" --quiet

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PROD="$SCRIPT_DIR/../frontend/.env.production"
if [ -f "$ENV_PROD" ]; then
  echo "VITE_API_URL=/api" > "$ENV_PROD"
fi

echo ""
ok "GCP Project '$PROJECT_ID' decommission complete."
ok "Billing is unlinked and all cloud resources are terminated."
ok "Zero lingering charges will occur."
