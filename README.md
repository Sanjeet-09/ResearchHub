# ResearchHub OS

Cloud-native web application for managing the full lifecycle of university research projects, experiment tracking, dataset version control, document repositories, equipment reservation, and interactive testing environments.

## Emergency Cleanup / Teardown

If you need to stop spending or clean up GCP resources immediately:

```bash
# Emergency stop (stops compute, keeps data)
./scripts/teardown.sh --project PROJECT_ID --mode emergency --dry-run
./scripts/teardown.sh --project PROJECT_ID --mode emergency

# Complete wipe (removes all GCP resources, storage, secrets, Firebase)
./scripts/teardown.sh --project PROJECT_ID --mode wipe --dry-run
./scripts/teardown.sh --project PROJECT_ID --mode wipe
```

## Local Development (Phase 0)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start local database:**
   ```bash
   docker-compose up -d
   ```

3. **Start frontend dev server:**
   ```bash
   npm run dev:frontend
   ```

4. View the design system component showcase at `http://localhost:3000/design`.

## Monorepo Layout

- `frontend/`: React 18, Vite, Tailwind CSS 3, UI Component Library.
- `shared/`: `@rh/shared` pool, error classes, logger, auth middleware, storage adapter.
- `services/`: Gateway and 10 Cloud Run microservices.
- `db/`: SQL migrations and seed data.
- `scripts/`: Teardown and deployment scripts.
