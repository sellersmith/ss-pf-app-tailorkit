# ss-pf-app-tailorkit

TailorKit admin artifact producer for PageFly app-platform.

This repo exists to split TailorKit admin build/deploy from the PageFly Core Jenkins build.

## Status

Build-ready TailorKit admin artifact repo.

TailorKit admin source is present under `apps/tailorkit`. CI can build and package the admin static artifact without PageFly Core.

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
wip -> beta -> rc -> main
```

Channel mapping:

```txt
wip  -> tailorkit-wip
beta -> tailorkit-beta
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
  --target-app-root "$TARGET_APP_ROOT"
```

Dry-run deploy:

```bash
npm run deploy:admin-artifact:dry-run -- \
  --artifact artifacts/tailorkit-admin-static \
  --target-app-root "$TARGET_APP_ROOT"
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
$TARGET_APP_ROOT/
  releases/<artifact-id>/
  current/
  releases/ledger.jsonl
```

Default promote strategy is copy. Symlink can be enabled with `--strategy symlink` if static hosting supports it.
