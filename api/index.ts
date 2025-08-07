import { handleDocuments } from './documents';
import { handleSearch } from './search';

interface AIBinding {
  run(model: string, params: { text: string }): Promise<{ data: number[][] }>;
}

export interface Env {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: AIBinding;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      switch (true) {
        case path.startsWith('/api/documents'):
          response = await handleDocuments(request, env);
          break;
        case path === '/api/search':
          response = await handleSearch(request, env);
          break;
        default:
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to all responses
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (_error) {
      const errorResponse = Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
      Object.entries(corsHeaders).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }
  },
};