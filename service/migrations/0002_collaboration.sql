CREATE TABLE IF NOT EXISTS pdf_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pdf_id UUID NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('view','comment','edit')),
  invited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pdf_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pdf_collaborators_pdf ON pdf_collaborators(pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_collaborators_user ON pdf_collaborators(user_id);

CREATE TABLE IF NOT EXISTS pdf_share_links (
  token TEXT PRIMARY KEY,
  pdf_id UUID NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view','comment','edit')),
  created_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdf_share_links_pdf ON pdf_share_links(pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_share_links_expires ON pdf_share_links(expires_at);
