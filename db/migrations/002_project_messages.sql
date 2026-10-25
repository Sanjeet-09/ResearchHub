-- Migration 002_project_messages.sql
-- Project Discussion & Messaging Schema

CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient message feed queries ordered by timestamp
CREATE INDEX IF NOT EXISTS idx_project_messages_project_id_created_at
  ON project_messages (project_id, created_at DESC);
