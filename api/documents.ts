import type { Env } from './index';

export async function handleDocuments(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /api/documents - Create document
  if (path === '/api/documents' && method === 'POST') {
    const body = await request.json() as { title: string; content: string };
    const { title, content } = body;
    const id = crypto.randomUUID();

    // Generate embedding using Cloudflare AI Workers
    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: content
    });

    if (!embedding.data || !embedding.data[0]) {
      return Response.json({ error: 'Failed to generate embedding' }, { status: 500 });
    }

    // Store vector in Vectorize
    await env.VECTORS.upsert([{
      id,
      values: embedding.data[0],
      metadata: { title }
    }]);

    // Store document in D1
    await env.DB.prepare(`
      INSERT INTO documents (id, title, content, vector_id, created)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, title, content, id, Math.floor(Date.now() / 1000)).run();

    return Response.json({ id, title, content });
  }

  // GET /api/documents/:id - Get single document
  if (path.startsWith('/api/documents/') && method === 'GET') {
    const id = path.split('/')[3];
    const document = await env.DB.prepare('SELECT * FROM documents WHERE id = ?')
      .bind(id).first();

    return document 
      ? Response.json(document)
      : new Response('Not Found', { status: 404 });
  }

  // GET /api/documents - List documents
  if (path === '/api/documents' && method === 'GET') {
    const documents = await env.DB.prepare(`
      SELECT id, title, created FROM documents 
      ORDER BY created DESC LIMIT 50
    `).all();

    return Response.json({ documents: documents.results });
  }

  return new Response('Method not allowed', { status: 405 });
}