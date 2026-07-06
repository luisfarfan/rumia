CREATE TABLE IF NOT EXISTS captured_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    original_url TEXT,
    raw_input TEXT NOT NULL,
    source_channel VARCHAR(50) NOT NULL,
    detected_source VARCHAR(100),
    idempotency_key VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'received',
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_captured_items_user_id ON captured_items(user_id);
CREATE INDEX IF NOT EXISTS idx_captured_items_status ON captured_items(status);

ALTER TABLE captured_items ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE captured_items ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE captured_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE captured_items ADD COLUMN IF NOT EXISTS file_id VARCHAR(255);
ALTER TABLE captured_items ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE captured_items ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
ALTER TABLE captured_items ADD COLUMN IF NOT EXISTS file_size INTEGER;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS item_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES captured_items(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_item_chunks_item_id ON item_chunks(item_id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_name_lower ON nodes (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_nodes_name_trgm ON nodes USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    item_id UUID REFERENCES captured_items(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_node, target_node, type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_edges_source_node ON edges(source_node);
CREATE INDEX IF NOT EXISTS idx_edges_target_node ON edges(target_node);
CREATE INDEX IF NOT EXISTS idx_edges_item_id ON edges(item_id);

CREATE TABLE IF NOT EXISTS claim_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES captured_items(id) ON DELETE CASCADE,
    claim TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'True', 'False', 'Inconclusive'
    explanation TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]', -- array of { title, url }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claim_verifications_item_id ON claim_verifications(item_id);


