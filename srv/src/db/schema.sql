-- quotes: Parsed quotes from markdown
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL UNIQUE,
    content_hash TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- quote_relations: "Related:" chains
CREATE TABLE IF NOT EXISTS quote_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_quote_id INTEGER NOT NULL,
    related_quote_id INTEGER NOT NULL,
    relation_order INTEGER NOT NULL,
    FOREIGN KEY (parent_quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (related_quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    UNIQUE(parent_quote_id, related_quote_id)
);

-- served_quotes: Track served quotes for cycle
CREATE TABLE IF NOT EXISTS served_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    served_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

-- daily_quote: Today's cached selection
CREATE TABLE IF NOT EXISTS daily_quote (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    quote_date DATE NOT NULL UNIQUE,
    is_related BOOLEAN DEFAULT FALSE,
    parent_chain_id INTEGER,
    chain_position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

-- api_keys: Hashed API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    invalidated_at DATETIME
);

-- sync_log: Track sync operations
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_url TEXT NOT NULL,
    quotes_added INTEGER DEFAULT 0,
    quotes_updated INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_served_quotes_date ON served_quotes(served_date);
CREATE INDEX IF NOT EXISTS idx_served_quotes_quote_id ON served_quotes(quote_id);
CREATE INDEX IF NOT EXISTS idx_daily_quote_date ON daily_quote(quote_date);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_quote_relations_parent ON quote_relations(parent_quote_id);
CREATE INDEX IF NOT EXISTS idx_quotes_active ON quotes(is_active);
