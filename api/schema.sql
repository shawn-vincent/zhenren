-- Simple single table for documents
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  vector_id TEXT,
  created INTEGER DEFAULT (unixepoch())
);