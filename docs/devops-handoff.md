# DevOps Handoff

## Repo

`sellersmith/ss-pf-app-tailorkit`

## Goal

Publish TailorKit app-platform artifacts independently from PageFly Core/Server builds.

PageFly should consume immutable GitHub Release assets by:

```txt
version + url + sha256
```

## Required CI

Current GitHub Actions workflow:

```txt
.github/workflows/app-platform-artifact.yml
```

Stages:

```bash
npm ci
npm run ci:contract
npm run build:artifact
upload dist/artifacts/*.tgz
upload dist/artifacts/*.tgz.sha256
upload dist/artifacts/*.tgz.release.json
publish GitHub Release assets on tailorkit-v* tags
```

## Release Tags

```txt
tailorkit-v0.1.0-beta.12
tailorkit-v0.1.0-rc.3
tailorkit-v0.1.0
```

Production must consume stable immutable tags only.

## PageFly Integration

After release, PageFly config should contain:

```json
{
  "tailorkit": {
    "version": "0.1.0-beta.12",
    "url": "https://github.com/sellersmith/ss-pf-app-tailorkit/releases/download/tailorkit-v0.1.0-beta.12/ss-pf-app-tailorkit-0.1.0-beta.12.tgz",
    "sha256": "<sha256>"
  }
}
```

PageFly Jenkins must set:

```txt
APP_PLATFORM_ARTIFACTS_CONFIG=<env-specific config path>
```

## Rollback

Rollback is config-only:

1. Restore previous `version/url/sha256`.
2. Rerun PageFly artifact install/deploy.
3. Restart PageFly server through existing PageFly flow.

No TailorKit rebuild is required.

## What DevOps Needs To Provide

- Ensure GitHub Actions has `contents: write` permission for release creation, or provide equivalent Jenkins release job.
- Ensure PageFly Jenkins can download GitHub Release assets for private repos.
- Provide env-specific `APP_PLATFORM_ARTIFACTS_CONFIG` file path/value for beta/rc/prod.
- Decide notification route for failed artifact workflow, if GitHub native notifications are not enough.
