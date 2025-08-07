import type { Env } from './index';

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const method = request.method;

  if (method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  if (!query) {
    return Response.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  // Generate query embedding using Cloudflare AI
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: query
  });

  if (!embedding.data || !embedding.data[0]) {
    return Response.json({ error: 'Failed to generate embedding' }, { status: 500 });
  }

  // Search similar vectors
  const results = await env.VECTORS.query(embedding.data[0], {
    topK: Math.min(limit, 20),
    returnMetadata: true
  });

  // Format results with metadata
  const searchResults = results.matches.map((match: {
    id: string;
    score: number;
    metadata?: { title?: string };
  }) => ({
    id: match.id,
    title: match.metadata?.title || 'Untitled',
    similarity: match.score
  }));

  return Response.json({ 
    query,
    results: searchResults 
  });
}