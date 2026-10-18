# web

The public website, rendered on demand by Astro on a Cloudflare Worker (`docs/decisions/0021`). Its content lives in Supabase and is read only through the `public_*` views, which never include the practice venue.

## Run it

```
pnpm db:start
pnpm dev --filter web
```

It listens on this worktree's port `<block>45`. `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` default to the local stack.

## Structure

```
src/
  pages/              Astro pages: document markup only, each renders a feature
  features/<name>/    React components from @rivr/ui, imported through index.ts
```

`astro check` runs as the typecheck. Every visible element comes from `@rivr/ui`, every word from `@rivr/i18n`.

## Who builds what

Lane C owns every page and block.
