# Ecomate TailorKit

## Quick Start

### Prerequisites

Before you begin, you'll need the following:

1. **Node.js >= 22.17.0**: [Download and install](https://nodejs.org/en/download/) or use [nvm](https://github.com/nvm-sh/nvm):

   ```shell
   nvm install 22.17.0
   nvm use 22.17.0
   ```

2. **Yarn**: Install globally if you don't have it:

   ```shell
   npm install -g yarn
   ```

3. **MongoDB**: Install [MongoDB Community Edition](https://www.mongodb.com/docs/manual/installation/) locally, or use [MongoDB Atlas](https://www.mongodb.com/atlas) for a cloud instance. Default connection: `mongodb://localhost:27017/tailorkit`.

4. **Shopify Partner Account**: [Create an account](https://partners.shopify.com/signup) if you don't have one.

5. **Test Store**: Set up either a [development store](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store) or a [Shopify Plus sandbox store](https://help.shopify.com/en/partners/dashboard/managing-stores/plus-sandbox-store) for testing your app.

6. **Service Keys** (see [Service Keys Setup](#service-keys-setup) below):
   - **Supabase**: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - **OpenAI**: `OPENAI_API_KEY`
   - **AWS S3**: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   - **Google Cloud**: Service account credentials for Google Sheets API

### Step-by-Step Setup

#### 1. Clone and install dependencies

```shell
git clone <repository-url>
cd emtailorkit
yarn install
```

This installs both root dependencies and extension workspace dependencies (`tailorkit-src`, `tailorkit-helper`, `onetick-src`).

#### 2. Set up environment variables

```shell
cp .env.example .env
```

Edit `.env` and fill in the required values. Key variables:

| Variable                | Description                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| `MONGODB_URI`           | MongoDB connection string (default: `mongodb://localhost:27017/tailorkit`) |
| `SHOPIFY_API_KEY`       | From your Shopify Partner Dashboard app credentials                        |
| `SHOPIFY_API_SECRET`    | From your Shopify Partner Dashboard app credentials                        |
| `SHOPIFY_APP_URL`       | Your app's tunnel URL (auto-set by `shopify app dev`)                      |
| `AWS_ACCESS_KEY_ID`     | AWS S3 access key                                                          |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 secret key                                                          |
| `SHOPIFY_TAILORKIT_ID`  | Theme extension UUID (see [step 5](#5-set-shopify_tailorkit_id))           |
| `OPENAI_API_KEY`        | OpenAI API key for AI features                                             |
| `SUPABASE_URL`          | Supabase project URL                                                       |
| `SUPABASE_ANON_KEY`     | Supabase anonymous key                                                     |

> See `.env.example` for the full list of environment variables.

#### 3. Create or link a Shopify app (`shopify.app.toml`)

This is the most important setup step. The `shopify.app.toml` file connects your local project to a Shopify Partner app. Without it, `shopify app dev` and `shopify app deploy` won't work.

**Option A: New developer (first time setup)**

1. Copy the example config as a starting point:

   ```shell
   cp shopify.app.example.toml shopify.app.toml
   ```

2. Create a new app in [Shopify Partners Dashboard](https://partners.shopify.com):
   - Go to **Apps** → **Create app** → Choose **Create app manually**
   - Copy the **Client ID** from the app's **Overview** page

3. Link your local project to the Shopify app:

   ```shell
   yarn config:link
   ```

   This runs [`shopify app config link`](https://shopify.dev/docs/api/shopify-cli/app/app-config-link), which will:
   - Prompt you to log in to your Shopify Partners account (if not already logged in)
   - Ask you to select the organization and app to link to
   - Pull the app's configuration from the Partners Dashboard and write it into `shopify.app.toml` (including `client_id`, scopes, redirect URLs, webhooks, etc.)
   - Set this config as the **default** for subsequent CLI commands (`app dev`, `app deploy`, etc.)

4. Update `shopify.app.toml` with your dev store URL:

   ```toml
   [build]
   dev_store_url = "your-store.myshopify.com"
   ```

**Option B: Existing developer (already have `shopify.app.toml`)**

If you already have a `shopify.app.toml` with the correct `client_id`, just set it as the active config:

```shell
yarn config:use shopify.app.toml
```

This runs [`shopify app config use`](https://shopify.dev/docs/api/shopify-cli/app/app-config-use), which sets the specified config file as the default for CLI commands. Unlike `config link`, it does **not** pull config from the Partners Dashboard — it just switches between existing local config files.

> **`config link` vs `config use`**:
>
> - `config link` = **creates/updates** a `.toml` file by pulling from the Partners Dashboard + sets it as default
> - `config use` = **switches** the default to an existing `.toml` file (no network calls)

> **Note**: The `.shopify/` directory is auto-managed by the Shopify CLI to store local state (logged-in user, dev store mappings per `client_id`). Don't edit it manually. The `shopify.app.toml` is developer-specific — the repo includes `shopify.app.example.toml` as a template. Each team member should have their own `shopify.app.toml` pointing to their own dev app.

#### 4. Generate theme extension (first time only)

If the `extensions/tailorkit/` directory doesn't exist or needs to be regenerated:

```shell
yarn generate extension
```

Choose **Theme App Extension** and name it **tailorkit**. You may need to temporarily remove `extensions/tailorkit/` to regenerate.

> Skip this step if `extensions/tailorkit/` already exists with the correct `shopify.extension.toml`.

#### 5. Set `SHOPIFY_TAILORKIT_ID`

The `SHOPIFY_TAILORKIT_ID` is the **theme extension UUID** — a unique identifier Shopify assigns to the `tailorkit` theme extension. It's used to:

- Construct theme editor deep-links so merchants can enable app blocks
- Check whether the app embed and app blocks are active on a store's theme
- Programmatically toggle app blocks on product templates

**How to get it:**

The ID is the `uid` field inside `extensions/tailorkit/shopify.extension.toml`:

```toml
name = "TailorKit"
uid = "735a9a23-..."    # ← This is your SHOPIFY_TAILORKIT_ID
type = "theme"
```

Copy the `uid` value into your `.env`:

```shell
SHOPIFY_TAILORKIT_ID=735a9a23-...
```

**When is the `uid` generated?**

- It's auto-generated by the Shopify CLI when you first run `shopify app generate extension` (step 4) or `shopify app deploy`.
- Once assigned, it's **permanent** and won't change across deployments.
- Each Shopify Partner app has its own extension UIDs — if you're using a different dev app than the team, your `uid` will be different.

**If `extensions/tailorkit/` already exists** (most cases): just open `extensions/tailorkit/shopify.extension.toml` and copy the `uid`.

**If you generated a new extension** (step 4): the `uid` will be in the newly created `shopify.extension.toml` after running `yarn generate extension`, or after your first `yarn deploy`.

> **Warning**: If `SHOPIFY_TAILORKIT_ID` is missing or wrong, theme block status checks will always return `false` (the app will think the extension is not enabled), and theme editor deep-links will be broken.

#### 6. Verify your setup

At this point you should have:

- [x] `node_modules/` installed (from `yarn install`)
- [x] `.env` file with required variables (including `SHOPIFY_TAILORKIT_ID`)
- [x] `shopify.app.toml` linked to your Shopify Partner app and set as default config
- [x] `extensions/tailorkit/` with `shopify.extension.toml`

### Local Development

Start the app with Shopify CLI tunnel:

```shell
yarn dev
```

This command:

1. Builds all extensions (`yarn build-ext`)
2. Enables the app proxy in `shopify.app.toml`
3. Starts Shopify CLI dev server with a tunnel

On first run, the Shopify CLI will:

- Ask you to log in to your Shopify Partners account
- Open a browser for authentication
- Create a tunnel to your local server
- Install the app on your dev store

**Local development without tunnel:**

```shell
yarn dev:localhost
```

> **Note:** The `dev:localhost` command uses the `--use-localhost` flag which makes the service entry point listen to localhost instead of using a tunnel. This is useful for testing most app features, but features that directly invoke your app (like Webhooks) won't work. For more information, see the [Shopify CLI documentation](https://shopify.dev/docs/api/shopify-cli/app/app-dev#flags-propertydetail-uselocalhost).

**Theme extension development (watch mode):**

```shell
yarn dev-ext
```

Runs `tailorkit-src`, `tailorkit-helper`, and `onetick-src` in parallel watch mode.

Local development is powered by [the Shopify CLI](https://shopify.dev/docs/apps/tools/cli). It logs into your partners account, connects to an app, provides environment variables, updates remote config, creates a tunnel and provides commands to generate extensions.

### Service Keys Setup

Here's how to obtain each required service key:

#### Supabase Setup

1. Go to [Supabase](https://supabase.com) and create a new project
2. Once your project is created, go to Project Settings > API
3. Copy the `Project URL` as your `SUPABASE_URL`
4. Copy the `anon public` key as your `SUPABASE_ANON_KEY`
5. Add these to your `.env` file

#### OpenAI Setup

1. Visit [OpenAI's platform](https://platform.openai.com)
2. Create an account or sign in
3. Go to API Keys section
4. Create a new API key
5. Copy the key and add it as `OPENAI_API_KEY` in your `.env` file

#### AWS S3 Setup

Contact QuyetDV or LongPC to get the AWS S3 keys on WIP to use :))

#### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google Sheets API for your project
4. Go to Credentials
5. Create a Service Account
6. Create a new key for the service account (JSON format)
7. Download the JSON file and use its values in your `.env` file

### AI Tools Setup (Optional)

#### Figma MCP Setup

Enables AI code generation directly from Figma designs in your IDE.

1. **Figma Desktop**: Enable Dev Mode MCP Server in Preferences
2. **Cursor**: Settings → MCP → Add server with URL `http://127.0.0.1:3845/sse`
3. **Usage**: Select Figma frame → prompt AI to generate code

[Full documentation](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Dev-Mode-MCP-Server)

#### Claude Code Jira Bug Resolver

AI-powered bug triage that queries Jira and provides actionable recommendations.

**Setup:**

Copy `.mcp.example.json` to `.mcp.json` and fill in your credentials:

```bash
cp .mcp.example.json .mcp.json
```

> **Security**: Never commit `.mcp.json` - it contains your personal API tokens.

```json
{
  "mcpServers": {
    "mcp-atlassian": {
      "command": "uvx",
      "args": [
        "mcp-atlassian",
        "--jira-url=https://bravebits.jira.com",
        "--jira-username=YOUR_EMAIL@bravebits.vn",
        "--jira-token=YOUR_JIRA_API_TOKEN"
      ],
      "env": {
        "project": "EMTLKIT",
        "assignee": "YOUR_JIRA_ACCOUNT_ID"
      }
    }
  }
}
```

> **Jira API token**: [Atlassian Account](https://id.atlassian.com/manage-profile/security/api-tokens) → Create API token
>
> **Jira Account ID**: Go to Jira → Profile → Copy ID from URL

**Usage:**

```
/bugs-resolver
```

**Features:**

- **Filter options**: Critical (P0/P1), My Assigned, Stale (>14 days), By Component
- **Smart triage**: Shows priority, status, age, and recommended actions
- **Critical evaluation**: Checks if bug has enough info before you start coding
- **Plan mode**: Suggests implementation plan for well-defined bugs

**Workflow:**

1. Run `/bugs-resolver` → Select filter criteria
2. Review bug list → Pick one to investigate
3. Claude evaluates clarity → Either "NEEDS MORE INFO" or "READY TO FIX"
4. If ready → Enter plan mode for implementation

## Deployment

### Environments

The project supports multiple deployment environments, each with its own Shopify app config:

| Environment     | Config File               | App URL                    | Build               | Deploy               |
| --------------- | ------------------------- | -------------------------- | ------------------- | -------------------- |
| **Dev** (local) | `shopify.app.toml`        | Your tunnel URL            | `yarn build`        | `yarn deploy`        |
| **WIP**         | `shopify.app.wip.toml`    | `wip-tailorkit.ecomate.co` | `yarn build-wip`    | `yarn deploy-wip`    |
| **RC**          | `shopify.app.rc.toml`     | `rc-tailorkit.ecomate.co`  | `yarn build-rc`     | `yarn deploy-rc`     |
| **Production**  | `shopify.app.master.toml` | `tailorkit.ecomate.co`     | `yarn build-master` | `yarn deploy-master` |

> **Important**: The `HOST` variable in your `.env` must match the target environment's URL. The deploy scripts validate this to prevent accidental deployments to the wrong environment.

### Build

```shell
# Local dev build
yarn build
```

The build process:

1. Cleans old exports (`yarn clean:exports`)
2. Builds all extensions (`yarn build-ext`)
3. Switches Shopify config (`yarn config:use <config-file>`)
4. Runs Remix/Vite production build

### Deploy

```shell
# Deploy local app
yarn deploy
```

Deploy runs `shopify app deploy` which pushes extension code and app configuration to Shopify.

## Gotchas / Troubleshooting

### Navigating/redirecting breaks an embedded app

Embedded Shopify apps must maintain the user session, which can be tricky inside an iFrame. To avoid issues:

1. Use `Link` from `@remix-run/react` or `@shopify/polaris`. Do not use `<a>`.
2. Use the `redirect` helper returned from `authenticate.admin`. Do not use `redirect` from `@remix-run/node`
3. Use `useSubmit` or `<Form/>` from `@remix-run/react`. Do not use a lowercase `<form/>`.

This only applies if you app is embedded, which it will be by default.

### Non Embedded

Shopify apps are best when they are embedded into the Shopify Admin. This template is configured that way. If you have a reason to not embed your please make 2 changes:

1. Change the `isEmbeddedApp` prop to false for the `AppProvider` in `/app/routes/app.jsx`
2. Remove any use of App Bridge APIs (`window.shopify`) from your code
3. Update the config for shopifyApp in `app/shopify.server.js`. Pass `isEmbeddedApp: false`

### OAuth goes into a loop when I change my app's scopes

If you change your app's scopes and authentication goes into a loop and fails with a message from Shopify that it tried too many times, you might have forgotten to update your scopes with Shopify.
To do that, you can run the `deploy` CLI command.

Using yarn:

```shell
yarn deploy
```

Using npm:

```shell
npm run deploy
```

Using pnpm:

```shell
pnpm run deploy
```

### My webhook subscriptions aren't being updated

This template registers webhooks after OAuth completes, using the `afterAuth` hook when calling `shopifyApp`.
The package calls that hook in 2 scenarios:

- After installing the app
- When an access token expires

During normal development, the app won't need to re-authenticate most of the time, so the subscriptions aren't updated.

To force your app to update the subscriptions, you can uninstall and reinstall it in your development store.
That will force the OAuth process and call the `afterAuth` hook.

### Admin created webhook failing HMAC validation

Webhooks subscriptions created in the [Shopify admin](https://help.shopify.com/en/manual/orders/notifications/webhooks) will fail HMAC validation. This is because the webhook payload is not signed with your app's secret key.

Create [webhook subscriptions](https://shopify.dev/docs/api/shopify-app-remix/v1/guide-webhooks) using the `shopifyApp` object instead.

Test your webhooks with the [Shopify CLI](https://shopify.dev/docs/apps/tools/cli/commands#webhook-trigger) or by triggering events manually in the Shopify admin(e.g. Updating the product title to trigger a `PRODUCTS_UPDATE`).

### Incorrect GraphQL Hints

By default the [graphql.vscode-graphql](https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql) extension for VS Code will assume that GraphQL queries or mutations are for the [Shopify Admin API](https://shopify.dev/docs/api/admin). This is a sensible default, but it may not be true if:

1. You use another Shopify API such as the storefront API.
2. You use a third party GraphQL API.

in this situation, please update the [.graphqlrc.ts](https://github.com/Shopify/shopify-app-template-remix/blob/main/.graphqlrc.ts) config.

### First parameter has member 'readable' that is not a ReadableStream.

See [hosting on Vercel](#hosting-on-vercel).

### Admin object undefined on webhook events triggered by the CLI

When you trigger a webhook event using the Shopify CLI, the `admin` object will be `undefined`. This is because the CLI triggers an event with a valid, but non-existent, shop. The `admin` object is only available when the webhook is triggered by a shop that has installed the app.

Webhooks triggered by the CLI are intended for initial experimentation testing of your webhook configuration. For more information on how to test your webhooks, see the [Shopify CLI documentation](https://shopify.dev/docs/apps/tools/cli/commands#webhook-trigger).

### Using Defer & await for streaming responses

To test [streaming using defer/await](https://remix.run/docs/en/main/guides/streaming) during local development you'll need to use the Shopify CLI slightly differently:

1. First setup ngrok: https://ngrok.com/product/secure-tunnels
2. Create an ngrok tunnel on port 8080: `ngrok http 8080`.
3. Copy the forwarding address. This should be something like: `https://f355-2607-fea8-bb5c-8700-7972-d2b5-3f2b-94ab.ngrok-free.app`
4. In a separate terminal run `yarn shopify app dev --tunnel-url=TUNNEL_URL:8080` replacing `TUNNEL_URL` for the address you copied in step 3.

By default the CLI uses a cloudflare tunnel. Unfortunately it cloudflare tunnels wait for the Response stream to finish, then sends one chunk.

This will not affect production, since tunnels are only for local development.

## Development Guidelines

### Branch Naming Convention

Branch names must follow this pattern: `^(feature|bugfix|release|hotfix)(/[a-z0-9._-]+)?$`

This means:

- Branch names must start with one of these prefixes:
  - `feature/` - For new features
  - `bugfix/` - For bug fixes
  - `release/` - For release branches
  - `hotfix/` - For urgent fixes to production
- After the prefix, you can optionally add a descriptive name using:
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Dots (.)
  - Underscores (\_)
  - Hyphens (-)
- Examples:
  - ✅ `feature/add-dark-mode`
  - ✅ `bugfix/fix-login-error`
  - ✅ `release/2.0.0`
  - ✅ `hotfix/security-patch`
  - ❌ `feat/new-feature` (invalid prefix)
  - ❌ `feature/New-Feature` (uppercase not allowed)
  - ❌ `feature/add space` (spaces not allowed)

## Benefits

Shopify apps are built on a variety of Shopify tools to create a great merchant experience.

<!-- TODO: Uncomment this after we've updated the docs -->
<!-- The [create an app](https://shopify.dev/docs/apps/getting-started/create) tutorial in our developer documentation will guide you through creating a Shopify app using this template. -->

The Remix app template comes with the following out-of-the-box functionality:

- [OAuth](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#authenticating-admin-requests): Installing the app and granting permissions
- [GraphQL Admin API](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#using-the-shopify-admin-graphql-api): Querying or mutating Shopify admin data
- [REST Admin API](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#using-the-shopify-admin-rest-api): Resource classes to interact with the API
- [Webhooks](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#authenticating-webhook-requests): Callbacks sent by Shopify when certain events occur
- [AppBridge](https://shopify.dev/docs/api/app-bridge): This template uses the next generation of the Shopify App Bridge library which works in unison with previous versions.
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences

## Tech Stack

This template uses [Remix](https://remix.run). The following Shopify tools are also included to ease app development:

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) allows your app to seamlessly integrate your app within Shopify's Admin.
- [Polaris React](https://polaris.shopify.com/) is a powerful design system and component library that helps developers build high quality, consistent experiences for Shopify merchants.
- [Webhooks](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#authenticating-webhook-requests): Callbacks sent by Shopify when certain events occur
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences

## Resources

- [Remix Docs](https://remix.run/docs/en/v1)
- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix)
- [Introduction to Shopify apps](https://shopify.dev/docs/apps/getting-started)
- [App authentication](https://shopify.dev/docs/apps/auth)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [App extensions](https://shopify.dev/docs/apps/app-extensions/list)
- [Shopify Functions](https://shopify.dev/docs/api/functions)
- [Getting started with internationalizing your app](https://shopify.dev/docs/apps/best-practices/internationalization/getting-started)
- [Global Styling (TailorKit)](docs/global-styling.md)
