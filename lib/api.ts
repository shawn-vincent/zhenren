const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://zhenren-api.your-subdomain.workers.dev'
  : 'http://localhost:8787';

export const documentsAPI = {
  async create(title: string, content: string) {
    const response = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    return response.json();
  },

  async get(id: string) {
    const response = await fetch(`${API_BASE}/api/documents/${id}`);
    return response.json();
  },

  async list() {
    const response = await fetch(`${API_BASE}/api/documents`);
    return response.json();
  },

  async search(query: string, limit = 10) {
    const response = await fetch(
      `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.json();
  }
};