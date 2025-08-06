# All-Netlify Vector Integration Proposal

**Date**: 2025-08-06  
**Author**: Claude Code  
**Status**: Proposal  

## Overview

Add vector search capabilities to the existing Expo universal app using **Netlify's complete platform** - static hosting, serverless functions, and Netlify DB (Postgres + pgvector). Single provider, zero architectural changes, purely additive.

## Current State
- Single-package Expo universal app (iOS/Android/Web/Electron)
- Tamagui + NativeWind UI system
- Clean build system with `npm run build:web` producing static files
- Web platform already supported via React Native Web

## Proposed Architecture

### Single Provider: Netlify Platform
- **Static Hosting**: Deploy existing `web-build/` output directly
- **Backend**: Netlify Functions for all API endpoints
- **Database**: Netlify DB (serverless Postgres powered by Neon)
- **Vector Search**: pgvector extension on Netlify DB
- **Authentication**: Netlify Identity (optional)

## Benefits of All-Netlify Approach

**Architectural Simplicity**
- ✅ Single provider, single mental model
- ✅ One deployment process for everything
- ✅ Auto-wired database connections via environment variables
- ✅ Unified billing and monitoring

**Developer Experience**
- ✅ No provider switching or API juggling
- ✅ Consistent authentication across all functions
- ✅ Single CLI for all operations (`netlify dev`, `netlify deploy`)
- ✅ Built-in local development environment

**Cost & Scalability**
- ✅ Netlify free tier: 125k requests/month, 100GB bandwidth
- ✅ Netlify DB: Serverless Postgres scales automatically
- ✅ No cold start penalties between services
- ✅ Pay-as-you-go scaling

## Implementation Plan

### Phase 1: Netlify Setup (Week 1)

1. **Initialize Netlify project**:
   ```bash
   npm install -D netlify-cli
   npx netlify init
   ```

2. **Create Netlify DB**:
   ```bash
   npx netlify db:create --name zhenren-db
   # Auto-provisions Postgres with connection string in NETLIFY_DATABASE_URL
   ```

3. **Enable pgvector extension**:
   ```sql
   -- Run via Netlify DB console or migration
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. **Database schema**:
   ```sql
   -- Documents table with vector embeddings
   CREATE TABLE documents (
     id BIGSERIAL PRIMARY KEY,
     title TEXT NOT NULL,
     content TEXT NOT NULL,
     embedding vector(384), -- gte-small embedding dimensions
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- HNSW index for fast vector similarity search
   CREATE INDEX documents_embedding_idx ON documents 
     USING hnsw (embedding vector_cosine_ops);
   
   -- Full-text search index for hybrid search
   CREATE INDEX documents_content_fts ON documents 
     USING gin(to_tsvector('english', content));
   ```

### Phase 2: Netlify Functions (Week 1)

1. **Project structure**:
   ```
   /your-repo/
   ├── netlify/
   │   └── functions/
   │       ├── search.ts           # Vector similarity search
   │       ├── upload-document.ts  # Document processing & storage
   │       ├── get-documents.ts    # Document retrieval
   │       └── delete-document.ts  # Document management
   └── netlify.toml                # Configuration
   ```

2. **Database client setup** (`lib/db.ts`):
   ```typescript
   import { neon } from '@netlify/neon';

   // Auto-wired via NETLIFY_DATABASE_URL
   const sql = neon(process.env.NETLIFY_DATABASE_URL!);
   export default sql;
   ```

3. **Vector search function** (`netlify/functions/search.ts`):
   ```typescript
   import type { Handler } from '@netlify/functions';
   import sql from '../../lib/db';

   export const handler: Handler = async (event) => {
     if (event.httpMethod !== 'POST') {
       return { statusCode: 405, body: 'Method Not Allowed' };
     }

     const { query, limit = 10, threshold = 0.7 } = JSON.parse(event.body!);

     try {
       // Generate embedding (using Netlify's AI features or external API)
       const embedding = await generateEmbedding(query);

       // Vector similarity search
       const results = await sql`
         SELECT 
           id,
           title,
           content,
           1 - (embedding <=> ${embedding}::vector) as similarity
         FROM documents
         WHERE 1 - (embedding <=> ${embedding}::vector) > ${threshold}
         ORDER BY embedding <=> ${embedding}::vector
         LIMIT ${limit}
       `;

       return {
         statusCode: 200,
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ results })
       };
     } catch (error) {
       return {
         statusCode: 500,
         body: JSON.stringify({ error: 'Search failed' })
       };
     }
   };

   async function generateEmbedding(text: string): Promise<number[]> {
     // Option 1: Use Netlify's AI features (when available)
     // Option 2: Call external embedding API (OpenAI, Cohere, etc.)
     // Option 3: Use local embedding model
     
     // Placeholder implementation
     const response = await fetch('https://api.openai.com/v1/embeddings', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         model: 'text-embedding-3-small',
         input: text
       })
     });
     
     const data = await response.json();
     return data.data[0].embedding;
   }
   ```

4. **Document upload function** (`netlify/functions/upload-document.ts`):
   ```typescript
   import type { Handler } from '@netlify/functions';
   import sql from '../../lib/db';

   export const handler: Handler = async (event) => {
     if (event.httpMethod !== 'POST') {
       return { statusCode: 405, body: 'Method Not Allowed' };
     }

     const { title, content } = JSON.parse(event.body!);

     try {
       // Generate embedding for the content
       const embedding = await generateEmbedding(content);

       // Insert document with embedding
       const [document] = await sql`
         INSERT INTO documents (title, content, embedding)
         VALUES (${title}, ${content}, ${embedding}::vector)
         RETURNING id, title, created_at
       `;

       return {
         statusCode: 201,
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ document })
       };
     } catch (error) {
       return {
         statusCode: 500,
         body: JSON.stringify({ error: 'Upload failed' })
       };
     }
   };
   ```

### Phase 3: Configuration (Week 1)

1. **Netlify configuration** (`netlify.toml`):
   ```toml
   [build]
     command = "npm run build:web"
     publish = "web-build"

   [functions]
     directory = "netlify/functions"
     node_bundler = "esbuild"

   [dev]
     framework = "react"
     command = "npm start"
     port = 8081

   [[headers]]
     for = "/api/*"
     [headers.values]
       Access-Control-Allow-Origin = "*"
       Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
       Access-Control-Allow-Headers = "Content-Type, Authorization"
   ```

2. **Environment variables** (via Netlify Dashboard):
   ```
   NETLIFY_DATABASE_URL=<auto-generated>
   OPENAI_API_KEY=<your-key>
   NODE_ENV=production
   ```

### Phase 4: Frontend Integration (Week 1)

1. **API client** (`lib/api.ts`):
   ```typescript
   const API_BASE = process.env.NODE_ENV === 'production' 
     ? 'https://your-site.netlify.app/.netlify/functions'
     : 'http://localhost:8888/.netlify/functions';

   export const searchDocuments = async (query: string, options = {}) => {
     const response = await fetch(`${API_BASE}/search`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ query, ...options })
     });
     return response.json();
   };

   export const uploadDocument = async (title: string, content: string) => {
     const response = await fetch(`${API_BASE}/upload-document`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ title, content })
     });
     return response.json();
   };
   ```

2. **Search component integration**:
   ```typescript
   import { searchDocuments } from '../lib/api';

   export function SearchComponent() {
     const [query, setQuery] = useState('');
     const [results, setResults] = useState([]);

     const handleSearch = async () => {
       const { results } = await searchDocuments(query);
       setResults(results);
     };

     // ... existing UI with Tamagui components
   }
   ```

## What Stays the Same
- ✅ Current file structure unchanged
- ✅ Expo build process unchanged  
- ✅ Mobile apps work exactly as before
- ✅ Electron desktop support maintained
- ✅ Tamagui + NativeWind UI system
- ✅ Theme system and existing components
- ✅ TypeScript configuration

## What Gets Added
- ➕ Vector search functionality
- ➕ Netlify Functions for backend API
- ➕ Netlify DB for persistence
- ➕ Web deployment automation
- ➕ Local development environment via `netlify dev`

## Deployment Flow
1. **Development**: `netlify dev` runs local functions + database
2. **Deploy**: Git push triggers automatic deployment
3. **Mobile**: Existing Expo/EAS process unchanged
4. **Desktop**: Existing Electron process unchanged

## Local Development Experience
```bash
# Start everything locally
netlify dev

# Runs:
# - Expo dev server (localhost:8081)
# - Netlify Functions (localhost:8888)
# - Connected to remote Netlify DB
# - Live reload for both frontend and functions
```

## Advanced Features (Optional)

### Hybrid Search
Combine vector similarity with traditional full-text search:
```sql
WITH vector_results AS (
  SELECT *, 1 - (embedding <=> $1::vector) as vector_score
  FROM documents
  WHERE 1 - (embedding <=> $1::vector) > 0.7
),
text_results AS (
  SELECT *, ts_rank_cd(to_tsvector('english', content), plainto_tsquery($2)) as text_score
  FROM documents
  WHERE to_tsvector('english', content) @@ plainto_tsquery($2)
)
SELECT * FROM (
  SELECT *, vector_score * 0.7 + COALESCE(text_score, 0) * 0.3 as combined_score
  FROM vector_results
  LEFT JOIN text_results USING (id)
  UNION
  SELECT *, COALESCE(vector_score, 0) * 0.7 + text_score * 0.3 as combined_score
  FROM text_results
  LEFT JOIN vector_results USING (id)
) combined
ORDER BY combined_score DESC;
```

### Real-time Updates (Netlify Functions + WebSockets)
```typescript
// Optional: Real-time document updates via Netlify's edge functions
export const handler: Handler = async (event, context) => {
  // WebSocket connection handling for live search results
};
```

## Success Metrics
- ✅ Web app deploys successfully to Netlify
- ✅ Vector search returns relevant results in <500ms
- ✅ Mobile apps continue working unchanged
- ✅ Single command local development (`netlify dev`)
- ✅ Zero provider coordination complexity
- ✅ Database queries perform well at scale

## Costs (Free Tier)
- **Netlify**: 125k function invocations, 100GB bandwidth/month
- **Netlify DB**: 1GB storage, 1k database connections/month
- **Total**: $0/month for development and moderate usage

## Timeline
- **Week 1**: Complete implementation and local development
- **Week 2**: Production deployment and testing
- **Week 3**: Performance optimization and monitoring

## Migration Path from Other Proposals
If coming from the Supabase proposal:
1. Replace Supabase client with Netlify API calls
2. Move Edge Functions to Netlify Functions
3. Migrate Supabase DB schema to Netlify DB
4. Update environment variables

## Next Steps
1. **Initialize Netlify project**: `npx netlify init`
2. **Create Netlify DB**: `npx netlify db:create`
3. **Implement Phase 1**: Database setup and first function
4. **Test locally**: `netlify dev`
5. **Deploy**: `git push` for automatic deployment

---

**Total Effort**: ~6-8 hours of development + setup
**Complexity**: Low - single provider, consistent patterns
**Risk**: Minimal - existing functionality unaffected, additive changes only
**Maintenance**: Low - unified platform, single deployment pipeline