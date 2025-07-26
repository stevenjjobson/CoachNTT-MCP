export const DATABASE_SCHEMA = `
-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  session_type TEXT CHECK(session_type IN ('feature', 'bugfix', 'refactor', 'documentation')) NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  estimated_completion INTEGER NOT NULL,
  current_phase TEXT NOT NULL,
  status TEXT CHECK(status IN ('active', 'checkpoint', 'handoff', 'complete')) NOT NULL,
  estimated_lines INTEGER NOT NULL,
  estimated_tests INTEGER NOT NULL,
  estimated_docs INTEGER NOT NULL,
  actual_lines INTEGER DEFAULT 0,
  actual_tests INTEGER DEFAULT 0,
  docs_updated BOOLEAN DEFAULT FALSE,
  context_budget INTEGER,
  context_used INTEGER DEFAULT 0,
  velocity_score REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Checkpoints table
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  checkpoint_number INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  context_used INTEGER NOT NULL,
  commit_hash TEXT,
  completed_components TEXT NOT NULL, -- JSON array
  metrics TEXT NOT NULL, -- JSON object
  continuation_plan TEXT, -- JSON object
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Context usage table
CREATE TABLE IF NOT EXISTS context_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  operation TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Reality snapshots table
CREATE TABLE IF NOT EXISTS reality_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  check_type TEXT CHECK(check_type IN ('comprehensive', 'quick', 'specific')) NOT NULL,
  discrepancies TEXT NOT NULL, -- JSON array
  confidence_score REAL NOT NULL,
  recommendations TEXT, -- JSON array
  auto_fixed_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  total_lines_written INTEGER DEFAULT 0,
  average_velocity REAL DEFAULT 0,
  completion_rate REAL DEFAULT 0,
  tech_stack TEXT, -- JSON array
  common_blockers TEXT, -- JSON array
  updated_at INTEGER NOT NULL
);

-- Blockers table
CREATE TABLE IF NOT EXISTS blockers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('technical', 'context', 'external', 'unclear_requirement')) NOT NULL,
  description TEXT NOT NULL,
  impact_score INTEGER NOT NULL,
  resolution TEXT,
  time_to_resolve INTEGER,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Quick actions table
CREATE TABLE IF NOT EXISTS quick_actions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tool_sequence TEXT NOT NULL, -- JSON array
  parameter_template TEXT NOT NULL, -- JSON object
  keyboard_shortcut TEXT,
  ui_group TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_used INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Documentation tracking table
CREATE TABLE IF NOT EXISTS documentations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  doc_type TEXT CHECK(doc_type IN ('readme', 'api', 'architecture', 'handoff')) NOT NULL,
  file_path TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  sections TEXT, -- JSON array
  "references" TEXT, -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Agent memory table for sub-agent learning
CREATE TABLE IF NOT EXISTS agent_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  input_context TEXT NOT NULL,
  decision_made TEXT NOT NULL,
  worked BOOLEAN DEFAULT TRUE,
  project_id TEXT,
  session_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Symbol registry for naming consistency
CREATE TABLE IF NOT EXISTS symbol_registry (
  id TEXT PRIMARY KEY,
  concept TEXT NOT NULL,
  chosen_name TEXT NOT NULL,
  context_type TEXT NOT NULL,
  project_id TEXT NOT NULL,
  confidence_score REAL DEFAULT 1.0,
  usage_count INTEGER DEFAULT 1,
  created_by_agent TEXT,
  session_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_name);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_context_usage_session ON context_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_reality_snapshots_session ON reality_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_blockers_session ON blockers(session_id);
CREATE INDEX IF NOT EXISTS idx_blockers_project ON blockers(project_id);
CREATE INDEX IF NOT EXISTS idx_documentations_session ON documentations(session_id);
CREATE INDEX IF NOT EXISTS idx_documentations_type ON documentations(doc_type);

-- Indexes for agent tables
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_symbol_registry_concept ON symbol_registry(concept);
CREATE INDEX IF NOT EXISTS idx_symbol_registry_project ON symbol_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_symbol_registry_name ON symbol_registry(chosen_name);
`;