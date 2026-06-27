# DevOps Handoff

## Repo

`sellersmith/ss-pf-app-tailorkit`

Private GitHub repo for TailorKit app-platform admin artifact build/deploy.

## Goal

Create CI/CD for TailorKit admin static artifact independent from PageFly Core build.

## Required Jenkins Job

Trigger branches:

```txt
wip
beta
rc
main
```

Suggested stages:

```bash
npm install
npm run ci:contract
npm run build:admin-artifact
npm run deploy:admin-artifact:dry-run -- \
  --artifact artifacts/tailorkit-admin-static \
  --target-app-root "$TARGET_APP_ROOT"
npm run deploy:admin-artifact -- \
  --artifact artifacts/tailorkit-admin-static \
  --target-app-root "$TARGET_APP_ROOT"
```

`TARGET_APP_ROOT` is environment-specific and must be configured in Jenkins, not hardcoded in this repo.

Example value:

```txt
<pagefly-public-root>/app-platform/apps/tailorkit
```

## Deploy Permission

CI/CD deploy identity must have write permission to:

```txt
$TARGET_APP_ROOT
```

Do not use a personal SSH user for deployment.

## Promotion

The deploy script writes:

```txt
releases/<artifact-id>/
current/
releases/ledger.jsonl
```

Rollback is pointer/copy promotion to a previous release, not rebuild.

## What DevOps Needs To Provide

- Jenkins job wired to this repo's `Jenkinsfile`.
- GitHub credential that can read this private repo.
- CI/CD deploy identity with write permission to the env-specific `TARGET_APP_ROOT`.
- Decision whether Jenkins runs on beta host or deploys via mounted path/SSH wrapper.
