# Simple Netlify + Supabase Vector Integration

**Date**: 2025-08-05  
**Author**: Claude Code  
**Status**: Proposal  

## Overview

Add vector search capabilities to the existing Expo universal app using Supabase for backend services and Netlify for web hosting. **Zero architectural changes** - purely additive.

## Current State
- Single-package Expo universal app (iOS/Android/Web/Electron)
- Tamagui + NativeWind UI system
- Clean build system with `npm run build:web` producing static files
- Web platform already supported via React Native Web

## Proposed Architecture

### Static Web Hosting: Netlify
- Deploy existing `web-build/` output directly to Netlify
- Automatic deployments from GitHub pushes
- Global CDN for fast loading
- Free tier: 100GB bandwidth, 300 build minutes/month

### Backend Services: Supabase
- **Database**: PostgreSQL with pgvector extension for embeddings
- **Auth**: Client-side authentication (no SSR needed)
- **Vector Search**: Edge Functions with built-in `gte-small` embeddings (384-dim)
- **API**: Netlify Functions for any additional endpoints

## Implementation Plan

### Phase 1: Supabase Setup (Week 1)
1. Add dependencies:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Environment configuration (`.env.local`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

3. Create Supabase client (`lib/supabase.ts`):
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   
   export const supabase = createClient(
     process.env.EXPO_PUBLIC_SUPABASE_URL!,
     process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
   )
   ```

4. Database schema:
   ```sql
   -- Enable pgvector
   create extension if not exists vector;
   
   -- Documents table
   create table document (
     id bigserial primary key,
     title text,
     content text,
     embedding vector(384),
     created_at timestamptz default now()
   );
   
   -- HNSW index for fast vector search
   create index on document 
     using hnsw (embedding vector_cosine_ops);
   ```

### Phase 2: Vector Search Functions (Week 1)
1. Supabase Edge Function (`supabase/functions/search/index.ts`):
   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
   
   serve(async (req) => {
     const { query } = await req.json()
     
     // Generate embedding using Supabase's built-in gte-small
     const session = new Supabase.ai.Session('gte-small')
     const embedding = await session.run(query, { 
       mean_pool: true, 
       normalize: true 
     })
     
     // Search similar documents
     const { data } = await supabase.rpc('match_documents', {
       query_embedding: embedding,
       match_threshold: 0.78,
       match_count: 10
     })
     
     return Response.json(data)
   })
   ```

2. PostgreSQL search function:
   ```sql
   create or replace function match_documents(
     query_embedding vector(384),
     match_threshold float,
     match_count int
   )
   returns table (
     id bigint,
     title text,
     content text,
     similarity float
   )
   language sql stable
   as $$
     select
       id,
       title,
       content,
       1 - (embedding <=> query_embedding) as similarity
     from document
     where 1 - (embedding <=> query_embedding) > match_threshold
     order by embedding <=> query_embedding
     limit match_count;
   $$;
   ```

### Phase 3: Netlify Deployment (Week 1)
1. Connect GitHub repo to Netlify
2. Build settings:
   - Build command: `npm run build:web`
   - Publish directory: `web-build`
   - Environment variables: Add Supabase keys

3. Optional: Netlify Functions for additional API endpoints
4. Custom domain setup (if desired)

### Phase 4: Frontend Integration (Week 1)
1. Add search component using Supabase client:
   ```typescript
   const searchDocuments = async (query: string) => {
     const { data } = await supabase.functions.invoke('search', {
       body: { query }
     })
     return data
   }
   ```

2. Integrate with existing UI components
3. Add loading states and error handling

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
- ➕ Supabase client integration
- ➕ Web deployment to Netlify
- ➕ Optional Netlify Functions
- ➕ Environment configuration

## Benefits of This Approach

**Simplicity**: No monorepo, no architectural changes, no Next.js complexity
**Speed**: Static site deployment is fast and reliable
**Cost**: Netlify free tier + Supabase free tier = $0/month for development
**Scalability**: Both platforms scale automatically
**Maintainability**: Single codebase, single build process

## Deployment Flow
1. Developer pushes to GitHub
2. Netlify automatically builds and deploys web version
3. Mobile apps deploy via existing Expo/EAS process
4. Desktop apps build via existing Electron process

## Success Metrics
- ✅ Web app deploys successfully to Netlify
- ✅ Vector search returns relevant results in <500ms
- ✅ Mobile apps continue working unchanged
- ✅ No increase in build complexity
- ✅ Single codebase maintained

## Timeline
- **Week 1**: Complete implementation and deployment
- **Week 2**: Testing and refinement
- **Week 3**: Production ready

## Next Steps
1. Create Supabase project
2. Set up Netlify account and connect repo
3. Implement Phase 1 (Supabase integration)
4. Deploy and test

---

**Total Effort**: ~4-6 hours of development + deployment setup
**Complexity**: Low - purely additive changes
**Risk**: Minimal - existing functionality unaffected