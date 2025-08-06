Absolutely—here’s the **revised, drop-in proposal** that assumes **Supabase is your embedding provider** (via **Edge Functions + the built-in AI inference API** using the `gte-small` model). No external embedding vendor is required.

---

## 0) Goals & constraints (updated)

**Goals**

* Keep your **RN/RNW monorepo**; add a **Next.js** web entry that deploys to **Vercel**.
* **Auth**: Supabase (SSR with cookies on web).
* **Vectors**: Store embeddings in **Postgres/pgvector** on Supabase with an **HNSW** index.
* **Embeddings**: Generate via **Supabase Edge Functions** using `gte-small` (vector dim **384**).
* Provide **ingestion** (embed + insert) and **query** (embed + ANN) paths.
* Enforce **RLS**.

**Why this works**

* Supabase Edge Functions expose a **built-in AI inference API** for **embeddings** (`gte-small`) so you don’t need an external provider. ([Supabase][1])
* **HNSW** is the recommended pgvector index on Supabase for speed & robustness as data changes. ([Supabase][2])
* Supabase Auth is **SSR-compatible** via **`@supabase/ssr`** with cookie storage. ([Supabase][3])

---

## 1) High-level architecture

* **Web** (Vercel): Next.js (App Router), using your RNW UI.
* **Mobile**: Expo/React-Native (unchanged).
* **Auth**: Supabase (GoTrue) with cookie-based SSR (`@supabase/ssr`). ([Supabase][4])
* **DB**: Postgres + `pgvector` + **HNSW**. ([Supabase][2])
* **Edge Functions** (Supabase):

  * `embed` — one-shot embedding (dev/simple).
  * `ingest` — chunk text, embed with `gte-small` (384-dim), insert into `chunk`.
  * (Optional) `search` — embed query + call RPC inside Supabase for end-to-end low-latency search.
* **Automation** (optional now, add later): **Automatic embeddings** using Cron + Queues (`pgmq`) to re-embed on content updates. ([Supabase][5])

---

## 2) Schema & SQL

### 2.1 Enable pgvector

```sql
create extension if not exists vector;
```

### 2.2 Tables (tenant-safe)

> Set vector dimension to **384** to match `gte-small`.

```sql
-- Tenants (optional)
create table if not exists tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

-- Documents
create table if not exists document (
  id bigserial primary key,
  tenant_id uuid references tenant(id) on delete cascade,
  owner_user uuid references auth.users(id),
  title text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Chunks (embedded units)
create table if not exists chunk (
  id bigserial primary key,
  document_id bigint not null references document(id) on delete cascade,
  tenant_id uuid not null,
  owner_user uuid,
  content text not null,
  embedding vector(384) not null, -- gte-small
  created_at timestamptz not null default now()
);
```

### 2.3 HNSW index (cosine)

```sql
create index if not exists idx_chunk_embedding_hnsw
  on public.chunk
  using hnsw (embedding vector_cosine_ops);
```

(Supabase recommends HNSW; up to 2,000 dims can be indexed.) ([Supabase][6])

### 2.4 RPC for ANN search

```sql
create or replace function public.match_chunks(
  query_embedding vector(384),
  match_count int default 10,
  p_tenant uuid
) returns table(
  id bigint,
  document_id bigint,
  content text,
  similarity float
)
language sql stable parallel safe as
$$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunk c
  where c.tenant_id = p_tenant            -- pre-filter in the query
  order by c.embedding <=> query_embedding
  limit match_count
$$;
```

> **Note (filtering & ANN):** if you filter *after* an ANN index scan, you can get fewer than `k` rows. Always pre-filter in the indexed query (as above), or use an iterative strategy if you *must* post-filter. ([Supabase][7])

---

## 3) Edge Functions (Supabase) — embeddings with `gte-small`

### 3.1 `embed` (minimal, single string → embedding)

File: `supabase/functions/embed/index.ts`

```ts
// Deno runtime
// supabase functions new embed
const session = new Supabase.ai.Session('gte-small') // built-in model

Deno.serve(async (req) => {
  const { input } = await req.json()
  if (typeof input !== 'string' || !input.trim()) {
    return new Response(JSON.stringify({ error: 'input required' }), { status: 400 })
  }
  // mean_pool + normalize for cosine distance
  const embedding = await session.run(input, { mean_pool: true, normalize: true })
  return new Response(JSON.stringify({ embedding }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

This follows the **Generate Embeddings** guide using the built-in AI inference API. ([Supabase][1])

### 3.2 `ingest` (chunks → embed → insert)

File: `supabase/functions/ingest/index.ts`

```ts
const session = new Supabase.ai.Session('gte-small')

type Chunk = { content: string }
type Body = {
  tenantId: string
  documentId: number
  chunks: Chunk[]
}

Deno.serve(async (req) => {
  const supabase = createClient() // use service bindings; see Supabase docs on function DB access
  const { tenantId, documentId, chunks } = (await req.json()) as Body

  if (!tenantId || !documentId || !Array.isArray(chunks) || chunks.length === 0) {
    return new Response(JSON.stringify({ error: 'invalid payload' }), { status: 400 })
  }

  // Embed in batches
  const rows = []
  for (const c of chunks) {
    const vec = await session.run(c.content, { mean_pool: true, normalize: true })
    rows.push({
      document_id: documentId,
      tenant_id: tenantId,
      owner_user: null,         // or pass user id if desired
      content: c.content,
      embedding: vec,
    })
  }

  const { error } = await supabase.from('chunk').insert(rows)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  return new Response(JSON.stringify({ inserted: rows.length }), { status: 200 })
})
```

> **Automation later**: If you want background re-embedding (e.g., on document updates), wire **Automatic Embeddings** with **Cron** + **Queues (`pgmq`)**; Supabase’s guide shows the pattern. ([Supabase][5])

---

## 4) Web auth (Next.js on Vercel) with `@supabase/ssr`

**`/lib/supabase/server.ts`**

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value },
        set(name, value, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )
}
```

**Usage in Server Components / Route Handlers**

```ts
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  return Response.json({ email: user.email })
}
```

(Official SSR guidance + `@supabase/ssr` client config.) ([Supabase][4])

---

## 5) Search API (web) — uses Supabase for embedding + RPC for ANN

**`/app/api/search/route.ts`**

```ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs' // use 'edge' only if you know your deps support it

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { tenantId, query, k = 10 } = await req.json()

  // 1) call Supabase Edge Function to embed the query
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, // or pass user's access_token
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: query }),
  })
  if (!r.ok) return new Response(await r.text(), { status: 500 })
  const { embedding } = await r.json()

  // 2) ANN via RPC (pre-filter by tenant in the SQL itself)
  const { data: matches, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_count: k,
    p_tenant: tenantId,
  })
  if (error) return new Response(error.message, { status: 500 })

  return Response.json({ matches })
}
```

> **Alternative (even tighter latency):** implement a **`search` Edge Function** that both **embeds** and **calls the RPC** server-side within Supabase, then return rows to the Next.js route.

---

## 6) RLS (Row-Level Security)

```sql
alter table public.document enable row level security;
alter table public.chunk enable row level security;

-- Read: owner or same-tenant members
create policy "chunk_select_tenant_scoped"
on public.chunk
for select
to authenticated
using (
  exists (
    select 1 from public.document d
    where d.id = chunk.document_id
      and d.tenant_id = chunk.tenant_id
      -- extend this with your membership check (e.g., JWT claim or membership table)
  )
  and (owner_user = auth.uid() or owner_user is null)  -- adjust to your rules
);

-- Insert: owner only (adjust per your flows)
create policy "chunk_insert_owner"
on public.chunk for insert
to authenticated
with check (owner_user = auth.uid());

-- Update: owner only
create policy "chunk_update_owner"
on public.chunk for update
to authenticated
using (owner_user = auth.uid());
```

> Validate these with integration tests against both mobile and web SSR requests.

---

## 7) RN / RNW integration

* Keep shared UI in your monorepo.
* For the web app: add a **Next.js** package/app; deploy to **Vercel**.
* Mobile calls can hit your **Next APIs** (auth-aware) or directly call **Supabase**/**Edge Functions** with a **user access token**.

---

## 8) Deploy & configuration

**Vercel env**

* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`
* (Optional) `SUPABASE_SERVICE_ROLE_KEY` **(server only, never to the client)**

**Supabase**

* Deploy Edge Functions: `supabase functions deploy embed` (and `ingest`, etc.).
* (Optional) Set up **Cron** if you adopt the automatic embeddings pipeline. ([Supabase][8])

---

## 9) Performance & scaling notes

* Prefer **HNSW** for most cases; safe to add early and it stays robust as data changes. ([Supabase][6])
* Match **vector dimension** to your model (`gte-small` ⇒ `vector(384)`), and **don’t mix models** in the same column.
* **Pre-filter** inside your ANN query (e.g., tenant) to avoid the “returned fewer than `k` rows” pitfall; use iterative search only if truly needed. ([Supabase][7])
* If you plan bulk builds, consider off-peak builds; pgvector/HNSW build speed and options have improved materially over time. ([Supabase][9])

---

## 10) Implementation checklist

1. **DB**

   * Enable `vector`; create tables, **HNSW** index, RPC; enable **RLS**. ([Supabase][2])
2. **Edge Functions**

   * `embed` (query embeddings) and `ingest` (batch embed + insert). ([Supabase][1])
   * (Later) `search` in Edge to minimize latency.
3. **Auth (web)**

   * Use `@supabase/ssr` (cookie sessions) in App Router. ([Supabase][4])
4. **Next.js API**

   * `/api/search` calls `embed` then `match_chunks` RPC.
5. **RN mobile**

   * Call your Next APIs **or** Edge Functions directly with user tokens.
6. **Automation (optional)**

   * Add **Automatic Embeddings** with Cron + Queues for re-embedding. ([Supabase][5])
7. **Tests**

   * RLS positive/negative, RPC correctness, SSR cookie flow, ANN returns, index usage.

---

### Want a ready-to-commit starter PR?

Share your repo structure (packages, where RNW lives), and I’ll generate:

* a `supabase/` folder with **SQL migrations** + `embed`/`ingest` functions,
* a Next.js **`/lib/supabase/server.ts`**,
* an **`/app/api/search/route.ts`**,
* and a minimal **ingest script** to seed a few docs & verify search end-to-end.

[1]: https://supabase.com/docs/guides/ai/quickstarts/generate-text-embeddings "Generate Embeddings | Supabase Docs"
[2]: https://supabase.com/docs/guides/ai/vector-indexes?utm_source=chatgpt.com "Vector indexes | Supabase Docs"
[3]: https://supabase.com/docs/guides/auth/server-side?utm_source=chatgpt.com "Server-Side Rendering | Supabase Docs"
[4]: https://supabase.com/docs/guides/auth/server-side/creating-a-client?utm_source=chatgpt.com "Creating a Supabase client for SSR"
[5]: https://supabase.com/docs/guides/ai/automatic-embeddings?utm_source=chatgpt.com "Automatic embeddings | Supabase Docs"
[6]: https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes "HNSW indexes | Supabase Docs"
[7]: https://supabase.com/docs/guides/database/extensions/pgvector "pgvector: Embeddings and vector similarity | Supabase Docs"
[8]: https://supabase.com/docs/guides/functions/schedule-functions?utm_source=chatgpt.com "Scheduling Edge Functions | Supabase Docs"
[9]: https://supabase.com/blog/pgvector-fast-builds?utm_source=chatgpt.com "pgvector 0.6.0: 30x faster with parallel index builds"
