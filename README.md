# ss-pf-app-tailorkit

TailorKit artifact producer for the PageFly App Platform.

This repo builds TailorKit into an immutable app-platform artifact that PageFly consumes by `url + version + sha256`. PageFly CI must not checkout or build this repo as source.

## Flow

```txt
ss-pf-app-tailorkit
  -> npm run ci:contract
  -> npm run build:artifact
  -> publish GitHub Release assets
  -> PageFly downloads artifact from config
```

Avoid:

```txt
PageFly CI
  -> checkout TailorKit source
  -> build TailorKit inside PageFly Core/Server build
```

## Branch And Tag Flow

```txt
wip -> rc -> main/master
feature/* -> wip
hotfix/* -> main/master, then back-merge to rc and wip
```

Release tags:

```txt
tailorkit-v0.1.0-beta.12
tailorkit-v0.1.0-rc.3
tailorkit-v0.1.0
```

## Commands

```bash
npm ci
npm run ci:contract
npm run build:artifact
```

Output:

```txt
dist/artifacts/ss-pf-app-tailorkit-<version>.tgz
dist/artifacts/ss-pf-app-tailorkit-<version>.tgz.sha256
dist/artifacts/ss-pf-app-tailorkit-<version>.tgz.release.json
```

## Artifact Layout

```txt
artifact.json
admin/runtime/manifest.json
admin/copied-routes/manifest.json
server/plugin.js
server/src/**
theme-extension/theme-surfaces.js
fonts/*
checksums.sha256
```

## CI

GitHub Actions workflow:

```txt
.github/workflows/app-platform-artifact.yml
```

It builds artifacts on PR and `wip`/`rc`/`main`/`master`, uploads workflow artifacts, and publishes GitHub Release assets when a `tailorkit-v*` tag is pushed.

## PageFly Config

Use the generated `.tgz.release.json` to create PageFly config:

```bash
npm run app-platform:create-config -- \
  --metadata ./ss-pf-app-tailorkit-0.1.0.tgz.release.json \
  --out ./config/app-platform-artifacts.beta.json
```

PageFly consumes:

```json
{
  "apps": {
    "tailorkit": {
      "version": "0.1.0",
      "url": "https://github.com/sellersmith/ss-pf-app-tailorkit/releases/download/tailorkit-v0.1.0/ss-pf-app-tailorkit-0.1.0.tgz",
      "sha256": "<sha256>"
    }
  }
}
```
