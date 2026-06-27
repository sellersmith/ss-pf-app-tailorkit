## API Layer (`app/api`)

Short guide to the client API layer used to call Remix `routes/api.*` and external services.

### What it provides

- **Http**: Auth-aware wrapper with `Authorization` header, optional GET cache, unified errors.
- **Validation**: `parseWithZod` runtime parsing for safe, typed responses.
- **Services**: One file per domain, exposing cohesive, typed methods.
- **Types**: Shared shapes (`Pagination`, `ListResponse<T>`, `ApiResult<T>`).

### Structure

- `core/httpClient.ts`: `Http`, `ApiError`, request/response helpers.
- `core/validation.ts`: `parseWithZod(schema, payload, label)`.
- `services/*`: e.g., `TemplatesService`.
- `types/common.ts`: common types.

### How to call

```ts
import { Http } from '../core/httpClient'

// GET (with optional cache)
await Http.get<MyRes>('/api/example', { preferCache: true })

// POST JSON
await Http.post<MyRes, { name: string }>('/api/example', { name: 'TailorKit' })

// POST FormData
const form = new FormData()
form.append('file', file)
await Http.post<MyRes, FormData>('/api/upload', form)
```

- Binary responses (downloads): use native `fetch` and add `Authorization` manually (see `TemplatesService.export`).

### Validation

```ts
import { z } from 'zod'
import { parseWithZod } from '../core/validation'
const Z = z.object({ items: z.array(z.unknown()) })
const parsed = parseWithZod(Z, payload, 'list')
```

### Services pattern

- File per domain; export `DomainService` with clear methods (`list`, `getById`, `create`, `update`, ...).
- Validate responses with Zod; return app domain types (not raw backend shapes).
- Action endpoints use `?action=...` constants (e.g., `~/routes/api.templates/constants`).

Minimal skeleton:

```ts
import { z } from 'zod'
import { Http } from '../core/httpClient'
import { parseWithZod } from '../core/validation'
import type { Pagination, ListResponse, ApiResult } from '../types/common'

const ItemZ = z.object({ _id: z.string(), name: z.string().optional() }).passthrough()
const ListZ = z.object({ items: z.array(ItemZ).default([]), total: z.number().optional() })
type Item = z.infer<typeof ItemZ>

export const ItemsService = {
  async list(params: Pagination = {}): Promise<ListResponse<Item>> {
    const res = await Http.get<unknown>(`/api/items?page=${params.page ?? ''}&limit=${params.limit ?? ''}`)
    const r = parseWithZod(ListZ, res.data, 'items-list')
    return { items: r.items, total: r.total, page: params.page, limit: params.limit }
  },
}
```

### Errors & caching

- Errors normalize to `ApiError` (messages run through i18n).
- Validation failures throw `ApiError(422)`.
- Enable GET cache per-call with `{ preferCache: true }`.

### Add a new service (quick)

1. Create `services/<domain>.ts` and Zod schemas. 2) Implement `*Service` methods using `Http`. 3) Validate with `parseWithZod`. 4) Return domain types / `ApiResult<T>` for mutations.
