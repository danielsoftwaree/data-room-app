# Railway deploy

Status: repo-side deploy configuration is ready, but this environment cannot
provision Railway resources because the `railway` CLI is not installed and no
authenticated Railway project context is available.

Official references used:

- Railway monorepo deployment: https://docs.railway.com/deployments/monorepo
- Railway build configuration: https://docs.railway.com/builds/build-configuration
- Railway variables: https://docs.railway.com/variables

## Topology

Use one Railway project with four services:

1. `postgres` - Railway PostgreSQL.
2. `bucket` - Railway bucket or another S3-compatible bucket.
3. `api` - Nest API.
4. `web` - Vite static build.

Keep the repository root as the source root for both app services. This is a
shared Bun/Turbo monorepo; setting `rootDirectory` to `apps/api` or `apps/web`
would hide shared workspace packages.

## API service

Build settings:

```text
Builder: Railpack
Build command: bun run build --filter=api
Pre-deploy command: bun run --cwd packages/db db:migrate
Start command: bun run --cwd apps/api start:prod
Healthcheck path: /api/health
```

Variables:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGIN=https://<web-public-domain>
STORAGE_DRIVER=s3
S3_ENDPOINT=<bucket endpoint>
S3_REGION=<bucket region>
S3_BUCKET=<bucket name>
S3_ACCESS_KEY_ID=<bucket access key>
S3_SECRET_ACCESS_KEY=<bucket secret key>
```

Do not set `PORT`; Railway injects it. `DATABASE_POOL_MAX` may be set if the
database plan needs a smaller pool than the default `10`.

## Web service

Build settings:

```text
Builder: Railpack
Build command: bun run build --filter=web
```

Variables:

```text
VITE_API_URL=https://<api-public-domain>
RAILPACK_STATIC_FILE_ROOT=apps/web/dist
RAILPACK_SPA_OUTPUT_DIR=apps/web/dist
```

`VITE_API_URL` is intentionally optional locally. When unset, the generated API
client keeps using relative `/api` URLs, which Vite proxies to the local API in
development.

## Bucket wiring

Set `STORAGE_DRIVER=s3` on the API service and map bucket credentials to the
`S3_*` variables above. After deployment, upload a PDF and verify the object
appears in the bucket. If it appears in Postgres `file_blobs` instead,
`STORAGE_DRIVER` was not set to `s3` for the running API deployment.

## Smoke checklist

After both domains are live:

1. Open the web public URL.
2. Create a data room.
3. Create nested folders and reload a deep folder URL.
4. Upload two PDFs with the same name and verify the `(1)` suffix.
5. Open a PDF preview.
6. Search for a nested file by name and clear search back to the tree.
7. Rename a file/folder, delete a file, delete a folder with contents, then
   delete the data room.
8. Confirm API CORS allows only the web origin, not `*`.

## Redeploy and rotation

- Migrations run as the API pre-deploy command, not at app boot.
- To rotate bucket credentials, reset them in Railway, update
  `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` on the API service, then
  redeploy/restart the API.
- If build detection fails, keep the same root source and set the explicit
  build/start commands above rather than using per-app root directories.
