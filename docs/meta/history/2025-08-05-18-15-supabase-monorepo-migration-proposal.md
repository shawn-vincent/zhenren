# Supabase Vector Migration: Monorepo Architecture Proposal

**Date**: 2025-08-05  
**Author**: Orin (Claude Code)  
**Status**: Proposal  

## Architecture Verdict: CLEAN → DRIFTING (without intervention)

**Current State**: Clean single-package Expo universal app with excellent type safety and tooling uniformity.  
**Risk**: Adding Next.js without proper boundaries will create package chaos and dependency conflicts.  
**Solution**: Minimal workspace structure that preserves simplicity while enabling platform-specific deployments.

## Analysis: Current vs Required Architecture

### Current Structure (CLEAN)
```
zhenren/
├── app/                 # Expo Router (universal)
├── components/          # Shared UI components  
├── contexts/           # React Context providers
├── electron/           # Desktop entry point
└── package.json        # Single package, unified deps
```

**Strengths**:
- Single build system (Expo)
- Unified dependency management
- Consistent TypeScript config
- Clean theme system
- No version drift between platforms

**Constraints**:
- Cannot deploy Next.js to Vercel (requires separate build)
- Cannot use Next.js App Router SSR patterns
- Supabase SSR requires Next.js-specific client setup

## Recommended Architecture: Minimal Workspace

**Structure**:
```
zhenren/
├── packages/
│   ├── shared/          # Domain logic, types, utilities
│   ├── mobile/          # Expo app (current structure)
│   └── web/             # Next.js app for Vercel deployment
├── supabase/           # Edge Functions, migrations
├── package.json        # Workspace root
└── shared configs      # TypeScript, Biome, etc.
```

**Package Boundaries**:
- `shared`: Pure functions, types, business logic, Supabase client configs
- `mobile`: Expo Router, React Native components, mobile-specific features
- `web`: Next.js App Router, SSR auth, Vercel deployment optimizations

## Boundary Violations to Prevent

**Critical Rules**:
1. **No React Native imports in `web`** - use shared UI primitives only
2. **No Next.js imports in `mobile`** - use shared API clients only  
3. **No platform-specific auth in `shared`** - abstract auth interface only
4. **No Supabase client creation in UI components** - inject via context/props

**Dependency Flow** (outer → inner only):
```
mobile ────┐
           ├──→ shared ──→ supabase
web    ────┘
```

## Surface Diet: What to Delete/Inline

**Delete**:
- Current monolithic package.json scripts mixing all platforms
- Duplicate Tamagui configs (consolidate in shared)
- Platform-specific environment handling scattered across files

**Inline**:
- Single-use wrapper components around Tamagui
- One-off theme utilities (merge into ThemeContext)

**Rename for Clarity**:
- `app/` → `packages/mobile/app/` (explicit platform)
- `electron/` → `packages/mobile/electron/` (desktop is mobile variant)

## Migration Plan: 4 Reversible Commits

### Commit 1: Workspace Foundation
```bash
# Create workspace structure
mkdir -p packages/{shared,mobile,web}
mv app components contexts packages/mobile/
mv electron packages/mobile/

# Root package.json → workspace manager only
# Individual packages get their own configs
```

### Commit 2: Shared Package Creation  
```bash
# Extract pure utilities, types, constants
mkdir packages/shared/{lib,types,constants}

# Move Supabase client configs to shared
# Move theme types and utilities
# Create shared Zod schemas for API contracts
```

### Commit 3: Next.js Web Package
```bash
# Initialize Next.js in packages/web
# Add Supabase SSR setup with @supabase/ssr
# Create minimal UI using shared primitives
# Add Vercel deployment config
```

### Commit 4: Supabase Integration
```bash
# Add supabase/ directory with migrations and Edge Functions
# Wire up vector embeddings with gte-small (384-dim)
# Add RLS policies and HNSW indexes
# Create search API routes
```

## Version Management Strategy

**Principle**: Lock shared dependencies, allow platform-specific optimizations.

**Root package.json**:
```json
{
  "workspaces": ["packages/*"],
  "devDependencies": {
    "@biomejs/biome": "^2.1.3",
    "typescript": "~5.8.3"
  }
}
```

**Shared dependencies** (exact versions):
```json
{
  "react": "19.0.0",
  "react-dom": "19.0.0", 
  "@supabase/supabase-js": "2.x.x"
}
```

**Platform-specific** (managed separately):
- `mobile`: Expo SDK 53 constraints  
- `web`: Next.js App Router latest

## API Contract Design

**Before** (implicit boundaries):
```typescript
// Mixed concerns - auth + UI + data
const searchResults = await supabase.rpc('match_chunks', {...})
```

**After** (explicit contracts):
```typescript
// packages/shared/types/search.ts
export interface SearchRequest {
  query: string
  tenantId: string  
  limit?: number
}

export interface SearchResult {
  id: string
  content: string
  similarity: number
}

// packages/shared/lib/search-client.ts  
export abstract class SearchClient {
  abstract search(req: SearchRequest): Promise<SearchResult[]>
}

// Platform implementations inject concrete clients
```

## Flow Analysis: Critical Paths

**Search Flow** (optimized):
```
User Query → Next.js API Route → Supabase Edge Function (embed) → 
RPC (match_chunks) → Response (single round-trip)
```

**No ping-pong patterns**: Embedding and search happen server-side in Supabase region.

**Auth Flow** (SSR + mobile):
```
Web: Cookie-based SSR via @supabase/ssr
Mobile: Access token via Supabase client
Shared: Abstract auth context interface
```

## Observability & Testing Strategy

**Structured Logging**:
```typescript
// packages/shared/lib/logger.ts
export const logger = {
  searchQuery: (tenantId: string, query: string, resultCount: number) => 
    console.log(JSON.stringify({ 
      event: 'search_query',
      tenantId, 
      queryLength: query.length,
      resultCount,
      timestamp: new Date().toISOString()
    }))
}
```

**Contract Tests**:
- Supabase RPC function signatures
- Search API request/response shapes  
- Auth token validation flows
- Vector embedding dimensions (384 for gte-small)

## Performance Considerations

**Bundle Optimization**:
- Shared package: Pure functions only (tree-shakeable)
- Web package: Next.js automatic code splitting
- Mobile package: Expo bundle splitting by platform

**Database Performance**:
- HNSW index on vector(384) column
- Pre-filter by tenant_id in RPC (avoid post-filter row loss)
- Connection pooling via Supabase managed connections

## Implementation Checklist

**Phase 1: Structure** (Week 1)
- [ ] Create workspace with proper package boundaries
- [ ] Extract shared utilities and types  
- [ ] Validate mobile app still builds and runs
- [ ] Update CI/CD to handle workspace

**Phase 2: Next.js Integration** (Week 2)  
- [ ] Next.js App Router setup in packages/web
- [ ] Supabase SSR auth with @supabase/ssr
- [ ] Minimal UI using shared design tokens
- [ ] Vercel deployment pipeline

**Phase 3: Vector Search** (Week 3)
- [ ] Supabase migrations: pgvector, HNSW, RLS
- [ ] Edge Functions: embed, ingest, search
- [ ] API routes in Next.js for search
- [ ] Integration tests for end-to-end flow

**Phase 4: Mobile Integration** (Week 4)
- [ ] Mobile app consumes search APIs
- [ ] Shared auth context abstractions
- [ ] Cross-platform UI components
- [ ] Performance testing and optimization

## Risk Mitigation

**Version Conflicts**: Use exact versions for React/core deps, ranges for tooling.
**Build Complexity**: Each package has single responsibility and clear entry points.
**Deployment Coupling**: Packages deploy independently (Vercel, Expo builds, Electron).
**Type Safety**: Shared types package ensures API contracts match across platforms.

## Success Metrics

**Architectural**:
- Zero circular dependencies between packages
- All boundaries enforced by TypeScript compilation
- Single source of truth for business logic

**Performance**:
- Search latency < 200ms (embed + vector search)
- Bundle size increase < 20% per platform
- Build time stays under 2min per package

**Maintainability**:
- New features require changes in only 1-2 packages
- Platform-specific optimizations don't break other platforms
- Dependency upgrades isolated to relevant packages

---

**Next Steps**: Approve architecture direction, then implement Commit 1 (workspace foundation) as proof of concept.