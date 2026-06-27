# ss-pf-app-tailorkit

TailorKit admin artifact producer for PageFly app-platform.

This repo exists to split TailorKit admin build/deploy from the PageFly Core Jenkins build.

## Status

Phase 0 CI/CD skeleton.

The artifact contract and deploy scripts are present. Full TailorKit source migration is still pending, so `npm run build:admin-artifact` intentionally fails until `apps/tailorkit` source lands in this repo.

## Target Flow

```txt
ss-pf-app-tailorkit CI
  -> build TailorKit admin static artifact
  -> package artifacts/tailorkit-admin-static
  -> deploy to beta/prod static path
  -> promote current
```

Avoid:

```txt
PageFly CI
  -> checkout TailorKit source
  -> build TailorKit inside PageFly Core build
```

## Branch Flow

```txt
wip -> rc -> main
```

Channel mapping:

```txt
wip  -> tailorkit-wip
rc   -> tailorkit-rc
main -> tailorkit-live
```

## Commands

Verify repo contract:

```bash
npm run ci:contract
```

Build admin artifact:

```bash
npm run build:admin-artifact
```

Deploy artifact:

```bash
npm run deploy:admin-artifact -- \
  --artifact artifacts/tailorkit-admin-static \
  --target-app-root /var/www/pf-beta/public/app-platform/apps/tailorkit
```

Dry-run deploy:

```bash
npm run deploy:admin-artifact:dry-run -- \
  --artifact artifacts/tailorkit-admin-static \
  --target-app-root /var/www/pf-beta/public/app-platform/apps/tailorkit
```

## Artifact Layout

```txt
artifacts/tailorkit-admin-static/
  artifact-manifest.json
  admin/copied-routes/manifest.json
  admin/copied-routes/*
  fonts/*
```

## Deploy Layout

```txt
/var/www/pf-beta/public/app-platform/apps/tailorkit/
  releases/<artifact-id>/
  current/
  releases/ledger.jsonl
```

Default promote strategy is copy. Symlink can be enabled with `--strategy symlink` if static hosting supports it.

