# Client Components Directory

This directory is specifically designated for React components that **must** render exclusively on the client side.

## Usage Guidelines

1. Place any component that requires client-side functionality in this directory
2. Import these components using the following pattern:
   ```tsx
   import MyClientComponent from '@/components/.client/MyClientComponent'
   ```

## When to Use Client Components

Place components in this directory when they:

- Use browser-only APIs (localStorage, window, etc.)
- Depend on client-side event listeners
- Use hooks like `useState`, `useEffect`, or other client-side React hooks
- Need to interact with browser DOM directly
- Require client-side libraries that don't support server-side rendering

## Implementation Example

```tsx
'use client'

export default function ClientOnlyComponent() {
  // Client-side state or effects
  return <div>This component only renders on the client</div>
}
```

## Benefits

- Clear separation of client and server components
- Prevents hydration errors
- Improves code organization
- Makes component behavior more predictable

Remember: Components outside this directory should generally be server components unless explicitly marked with `'use client'` directive.
