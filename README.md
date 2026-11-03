# Epilyse

## Production deployment

The backend exposes `POST /webhooks/github` and the graph UI polls the
registered repository's status and `GET /repositories/{repository_id}/graph/latest`.
Configure the GitHub webhook for the **push** event and use the exact backend
URL, for example:

```text
https://your-backend.example.com/webhooks/github
```

Set these backend environment variables in Render:

```text
GITHUB_WEBHOOK_SECRET=<the same secret configured in GitHub>
GITHUB_TOKEN=<a token with access to the registered repositories>
EPILYSE_DB_PATH=/var/data/epilyse.db
EPILYSE_GRAPH_ROOT=/var/data/graphs
```

Attach a Render persistent disk mounted at `/var/data`. Without a persistent
disk, Render's filesystem is ephemeral and repository registrations, revisions,
and graph snapshots will disappear on restart or redeploy. The current
architecture intentionally keeps SQLite and JSON snapshots together on that
disk; a managed database/object-storage migration can be introduced later if
horizontal scaling is required.

Set the frontend environment variable to the deployed backend:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
```

Set the backend CORS allowlist to the deployed frontend origin(s), separated
by commas:

```text
CORS_ORIGINS=https://your-frontend.example.com
```

The frontend uses `http://localhost:8000` only in development. A production
build fails clearly if `NEXT_PUBLIC_API_BASE_URL` is missing instead of
silently sending requests to the browser's localhost.

## End-to-end verification

1. Deploy the backend and confirm `GET /health` returns `{"status":"ok"}`.
2. Register a repository through `POST /repositories/register`; record its
   returned `repository_id`.
3. Confirm the repository's selected branch is the branch configured in GitHub.
4. Push a commit and open GitHub webhook **Recent Deliveries**. The delivery
   should return HTTP 200 and `{"status":"accepted"}`.
5. Query `GET /repositories/{repository_id}` until `ingestion_status` is
   `completed`.
6. Query `GET /repositories/{repository_id}/graph/latest` and verify its
   `commit_sha` equals the pushed commit.
7. Open `/graph`; the frontend polls every five seconds and replaces its graph
   with the persisted latest snapshot.

If ingestion fails, the repository status endpoint exposes `last_error` and
the Render logs contain delivery, matching, checkout, parsing, and persistence
events. No webhook secret or access token is logged.
