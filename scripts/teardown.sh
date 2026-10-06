#!/usr/bin/env bash
# =============================================================================
# ResearchHub OS — teardown.sh
# Emergency cost-stop OR complete wipe of everything created on Google Cloud.
# Run from Cloud Shell, Linux, WSL or Git Bash (bash 4+). Needs the gcloud CLI.
# ALWAYS try --dry-run first. Assumes a DEDICATED project for ResearchHub OS.
# Supabase is NOT on GCP: pause/delete it from the Supabase dashboard.
# =============================================================================
set -o pipefail

if (( BASH_VERSINFO[0] < 4 )); then
  echo "Bash 4+ is required (use Cloud Shell, WSL or Git Bash)." >&2
  exit 1
fi

PROJECT_ID=""
MODE=""
REGION="${REGION:-asia-south1}"
GPU_REGION="${GPU_REGION:-}"
BUDGET_NAME="${BUDGET_NAME:-ResearchHub-50-USD-cap}"
DRY_RUN=false
ASSUME_YES=false
DEEP=false
UNLINK_BILLING=false
DELETE_PROJECT=false
FAILS=0

usage() {
cat <<'EOF'
ResearchHub OS - teardown

Usage:
  ./scripts/teardown.sh --project PROJECT_ID --mode emergency|wipe [options]

Modes:
  emergency   STOP SPENDING NOW. Cancels running builds, pauses Cloud Scheduler
              jobs, deletes ALL Cloud Run services and jobs (every lab session,
              every microservice, the gateway). Keeps data (buckets, secrets,
              images, service accounts) so you can redeploy later.
  wipe        COMPLETE WIPE. Everything in emergency mode, plus: deletes
              Scheduler jobs, Cloud Build triggers, ALL Cloud Storage buckets
              (including every object version), Artifact Registry repositories,
              Secret Manager secrets, user-created service accounts, the
              ResearchHub billing budget, and disables Firebase Hosting.

Options:
  --project ID       GCP project ID (required)
  --mode MODE        emergency | wipe (required)
  --region R         main region (default: $REGION or asia-south1)
  --gpu-region R     extra region to scan (if GPU labs live elsewhere)
  --deep             scan every Cloud Run / Scheduler region (slower, thorough)
  --unlink-billing   ALSO unlink the billing account (hard stop of all spend)
  --delete-project   ALSO delete the whole GCP project (30-day recovery window)
  --dry-run          show what would be deleted; change nothing
  --yes              skip the typed confirmation (for scripts)
  -h, --help         show this help
EOF
}

log()  { printf '\033[1;36m[teardown]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; }

# Runs a command; in dry-run mode only prints it. Failures are counted, never fatal.
run() {
  if $DRY_RUN; then printf '    [dry-run] %s\n' "$*"; return 0; fi
  if "$@" >/dev/null 2>&1; then
    printf '    deleted/done: %s\n' "$*"
    return 0
  fi
  warn "FAILED: $*"
  FAILS=$((FAILS + 1))
  return 1
}

# ----------------------------- argument parsing ------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)        PROJECT_ID="${2:-}"; shift 2 ;;
    --mode)           MODE="${2:-}"; shift 2 ;;
    --region)         REGION="${2:-}"; shift 2 ;;
    --gpu-region)     GPU_REGION="${2:-}"; shift 2 ;;
    --deep)           DEEP=true; shift ;;
    --unlink-billing) UNLINK_BILLING=true; shift ;;
    --delete-project) DELETE_PROJECT=true; shift ;;
    --dry-run)        DRY_RUN=true; shift ;;
    --yes)            ASSUME_YES=true; shift ;;
    -h|--help)        usage; exit 0 ;;
    *) err "Unknown option: $1"; usage; exit 1 ;;
  esac
done

[[ -n "$PROJECT_ID" ]] || { err "--project is required"; usage; exit 1; }
[[ "$MODE" == "emergency" || "$MODE" == "wipe" ]] || { err "--mode must be 'emergency' or 'wipe'"; usage; exit 1; }
command -v gcloud >/dev/null 2>&1 || { err "gcloud CLI not found"; exit 1; }

# ------------------------------- preflight -----------------------------------
ACCOUNT="$(gcloud config get-value account 2>/dev/null)"
[[ -n "$ACCOUNT" ]] || { err "Not logged in. Run: gcloud auth login"; exit 1; }
gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 || { err "Project '$PROJECT_ID' not found or no access."; exit 1; }

log "Account : $ACCOUNT"
log "Project : $PROJECT_ID"
log "Mode    : $MODE   (dry-run: $DRY_RUN, deep: $DEEP)"

# ------------------------------ discovery ------------------------------------
regions_to_scan() {
  local r=("$REGION")
  [[ -n "$GPU_REGION" ]] && r+=("$GPU_REGION")
  if $DEEP; then
    local more
    mapfile -t more < <(gcloud run regions list 2>/dev/null | awk 'NR>1 {print $1}')
    r+=("${more[@]}")
  fi
  printf '%s\n' "${r[@]}" | sed '/^$/d' | sort -u
}

# Prints "name<TAB>region" for Cloud Run services or jobs
collect_run() {
  local kind="$1" col r
  [[ "$kind" == "services" ]] && col="SERVICE" || col="JOB"
  {
    gcloud run "$kind" list --project "$PROJECT_ID" --format="value($col,REGION)" 2>/dev/null
    while read -r r; do
      gcloud run "$kind" list --project "$PROJECT_ID" --region "$r" \
        --format="value(metadata.name)" 2>/dev/null | awk -v r="$r" 'NF {print $1 "\t" r}'
    done < <(regions_to_scan)
  } | awk -F'\t' 'NF==2 && $1!="" && $2!=""' | sort -u
}

collect_scheduler() {
  local r
  while read -r r; do
    gcloud scheduler jobs list --project "$PROJECT_ID" --location "$r" \
      --format="value(name)" 2>/dev/null | awk -v r="$r" 'NF {n=split($1,a,"/"); print a[n] "\t" r}'
  done < <(regions_to_scan)
}

collect_triggers() {
  gcloud builds triggers list --project "$PROJECT_ID" --format="value(id)" 2>/dev/null \
    | awk 'NF {print $1 "\tglobal"}'
  gcloud builds triggers list --project "$PROJECT_ID" --region "$REGION" --format="value(id)" 2>/dev/null \
    | awk -v r="$REGION" 'NF {print $1 "\t" r}'
}

collect_builds() {
  gcloud builds list --ongoing --project "$PROJECT_ID" --format="value(id)" 2>/dev/null \
    | awk 'NF {print $1 "\tglobal"}'
  gcloud builds list --ongoing --project "$PROJECT_ID" --region "$REGION" --format="value(id)" 2>/dev/null \
    | awk -v r="$REGION" 'NF {print $1 "\t" r}'
}

collect_artifact_repos() {
  gcloud artifacts repositories list --project "$PROJECT_ID" --format="value(name)" 2>/dev/null \
    | awk -F/ 'NF {print $NF "\t" $4}'
}

collect_buckets() {
  gcloud storage ls --project "$PROJECT_ID" 2>/dev/null | sed '/^$/d'
}

collect_secrets() {
  gcloud secrets list --project "$PROJECT_ID" --format="value(name)" 2>/dev/null | awk -F/ 'NF {print $NF}'
}

collect_service_accounts() {
  gcloud iam service-accounts list --project "$PROJECT_ID" --format="value(email)" 2>/dev/null \
    | grep -Ev -- '-compute@developer\.gserviceaccount\.com$|@appspot\.gserviceaccount\.com$|^firebase-adminsdk-' \
    | sed '/^$/d'
}

BILLING_ACCOUNT="$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingAccountName)" 2>/dev/null)"
BILLING_ACCOUNT="${BILLING_ACCOUNT#billingAccounts/}"

collect_budgets() {
  [[ -n "$BILLING_ACCOUNT" ]] || return 0
  gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" --format="value(name,displayName)" 2>/dev/null \
    | awk -F'\t' -v n="$BUDGET_NAME" '$2==n {print $1}'
}

discover() {
  log "Scanning project (this can take a minute)..."
  mapfile -t SERVICES   < <(collect_run services)
  mapfile -t JOBS       < <(collect_run jobs)
  mapfile -t SCHED      < <(collect_scheduler)
  mapfile -t BUILDS     < <(collect_builds)
  if [[ "$MODE" == "wipe" ]]; then
    mapfile -t TRIGGERS < <(collect_triggers)
    mapfile -t REPOS    < <(collect_artifact_repos)
    mapfile -t BUCKETS  < <(collect_buckets)
    mapfile -t SECRETS  < <(collect_secrets)
    mapfile -t SAS      < <(collect_service_accounts)
    mapfile -t BUDGETS  < <(collect_budgets)
  else
    TRIGGERS=(); REPOS=(); BUCKETS=(); SECRETS=(); SAS=(); BUDGETS=()
  fi
}

show_list() { # $1 title, rest = items
  local title="$1"; shift
  printf '  %-34s %s\n' "$title" "$#"
  local i
  for i in "$@"; do printf '        - %s\n' "${i//$'\t'/  @ }"; done
}

print_inventory() {
  echo
  log "RESOURCES THAT WILL BE AFFECTED"
  show_list "Running Cloud Build builds (cancel)"       "${BUILDS[@]}"
  if [[ "$MODE" == "emergency" ]]; then
    show_list "Cloud Scheduler jobs (pause)"            "${SCHED[@]}"
  else
    show_list "Cloud Scheduler jobs (delete)"           "${SCHED[@]}"
  fi
  show_list "Cloud Run services (delete)"               "${SERVICES[@]}"
  show_list "Cloud Run jobs (delete)"                   "${JOBS[@]}"
  if [[ "$MODE" == "wipe" ]]; then
    show_list "Cloud Build triggers (delete)"           "${TRIGGERS[@]}"
    show_list "Cloud Storage buckets (delete + objects)" "${BUCKETS[@]}"
    show_list "Artifact Registry repos (delete)"        "${REPOS[@]}"
    show_list "Secret Manager secrets (delete)"         "${SECRETS[@]}"
    show_list "Service accounts (delete)"               "${SAS[@]}"
    show_list "Billing budget '$BUDGET_NAME' (delete)"  "${BUDGETS[@]}"
    echo "  Firebase Hosting                   disable (if firebase CLI is installed)"
  fi
  $UNLINK_BILLING && echo "  Billing account                    UNLINK from project (hard stop)"
  $DELETE_PROJECT && echo "  ENTIRE PROJECT                     DELETE ($PROJECT_ID)"
  echo
}

confirm() {
  $DRY_RUN && return 0
  $ASSUME_YES && return 0
  warn "This is IRREVERSIBLE for everything listed above."
  local ans ans2
  read -r -p "Type the project ID ($PROJECT_ID) to continue: " ans
  [[ "$ans" == "$PROJECT_ID" ]] || { err "Confirmation did not match. Nothing was deleted."; exit 1; }
  if $DELETE_PROJECT; then
    read -r -p "Type  DELETE $PROJECT_ID  to delete the whole project: " ans2
    [[ "$ans2" == "DELETE $PROJECT_ID" ]] || { err "Confirmation did not match. Nothing was deleted."; exit 1; }
  fi
}

# ------------------------------ execution ------------------------------------
each() { # $1 = array name, $2 = function name taking (name region)
  local -n arr="$1"; local fn="$2" item name region
  for item in "${arr[@]}"; do
    name="${item%%$'\t'*}"; region="${item#*$'\t'}"
    "$fn" "$name" "$region"
  done
}

do_cancel_build()     { if [[ "$2" == "global" ]]; then run gcloud builds cancel "$1" --project "$PROJECT_ID"; else run gcloud builds cancel "$1" --project "$PROJECT_ID" --region "$2"; fi; }
do_pause_sched()      { run gcloud scheduler jobs pause "$1" --project "$PROJECT_ID" --location "$2"; }
do_delete_sched()     { run gcloud scheduler jobs delete "$1" --project "$PROJECT_ID" --location "$2" --quiet; }
do_delete_service()   { run gcloud run services delete "$1" --project "$PROJECT_ID" --region "$2" --quiet; }
do_delete_job()       { run gcloud run jobs delete "$1" --project "$PROJECT_ID" --region "$2" --quiet; }
do_delete_trigger()   { if [[ "$2" == "global" ]]; then run gcloud builds triggers delete "$1" --project "$PROJECT_ID" --quiet; else run gcloud builds triggers delete "$1" --project "$PROJECT_ID" --region "$2" --quiet; fi; }
do_delete_repo()      { run gcloud artifacts repositories delete "$1" --project "$PROJECT_ID" --location "$2" --quiet; }

execute() {
  log "STEP 1/3  Stopping compute (this is what costs money)"
  each BUILDS do_cancel_build
  if [[ "$MODE" == "emergency" ]]; then each SCHED do_pause_sched; else each SCHED do_delete_sched; fi
  each SERVICES do_delete_service
  each JOBS do_delete_job

  if [[ "$MODE" == "wipe" ]]; then
    log "STEP 2/3  Deleting build config, storage, images, secrets, accounts, budget"
    each TRIGGERS do_delete_trigger
    local b s sa bud
    for b in "${BUCKETS[@]}";  do run gcloud storage rm -r --all-versions "${b%/}" --project "$PROJECT_ID"; done
    each REPOS do_delete_repo
    for s in "${SECRETS[@]}";  do run gcloud secrets delete "$s" --project "$PROJECT_ID" --quiet; done
    for sa in "${SAS[@]}";     do run gcloud iam service-accounts delete "$sa" --project "$PROJECT_ID" --quiet; done
    for bud in "${BUDGETS[@]}"; do run gcloud billing budgets delete "$bud" --billing-account="$BILLING_ACCOUNT" --quiet; done
    if command -v firebase >/dev/null 2>&1; then
      run firebase hosting:disable --project "$PROJECT_ID" --force
    else
      warn "firebase CLI not found: disable Hosting manually (Firebase console > Hosting)."
    fi
  else
    log "STEP 2/3  (emergency mode: data, secrets, images and accounts are kept)"
  fi

  log "STEP 3/3  Billing / project"
  if $UNLINK_BILLING; then run gcloud billing projects unlink "$PROJECT_ID"; fi
  if $DELETE_PROJECT;  then run gcloud projects delete "$PROJECT_ID" --quiet; fi
}

verify() {
  $DRY_RUN && return 0
  $DELETE_PROJECT && return 0
  $UNLINK_BILLING && warn "Billing is unlinked: verification calls may fail; that is expected."
  log "Verifying..."
  local left_s left_j left_b
  left_s="$(collect_run services | wc -l)"
  left_j="$(collect_run jobs | wc -l)"
  printf '  Cloud Run services left : %s\n' "$left_s"
  printf '  Cloud Run jobs left     : %s\n' "$left_j"
  if [[ "$MODE" == "wipe" ]]; then
    left_b="$(collect_buckets | wc -l)"
    printf '  Storage buckets left    : %s\n' "$left_b"
    printf '  Secrets left            : %s\n' "$(collect_secrets | wc -l)"
    printf '  Artifact repos left     : %s\n' "$(collect_artifact_repos | wc -l)"
    printf '  Service accounts left   : %s\n' "$(collect_service_accounts | wc -l)"
  fi
}

# --------------------------------- main --------------------------------------
discover
print_inventory
confirm
execute
verify

echo
if $DRY_RUN; then
  log "Dry run finished. Nothing was changed."
else
  [[ $FAILS -eq 0 ]] && log "Done. Everything listed was removed." || warn "Finished with $FAILS failed step(s). Re-run the script, or check the GCP console."
  log "Reminder: Supabase (database) is NOT on GCP. Pause or delete it in the Supabase dashboard."
  log "Reminder: also check Billing > Reports in the console to confirm spending has stopped."
fi
exit $(( FAILS > 0 ? 1 : 0 ))
