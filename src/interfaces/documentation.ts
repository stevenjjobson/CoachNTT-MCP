export interface DocGenerateParams {
  session_id: string;
  doc_type: 'readme' | 'api' | 'architecture' | 'handoff';
  include_sections?: string[];
}

export interface DocGenerateResponse {
  document_path: string;
  sections_generated: string[];
  word_count: number;
  references_included: string[];
}

export interface DocUpdateParams {
  file_path: string;
  update_type: 'sync' | 'append' | 'restructure';
  context?: Record<string, unknown>;
}

export interface DocumentStatus {
  file_path: string;
  last_updated: number;
  sync_status: 'current' | 'outdated' | 'missing';
  referenced_items: Array<{
    type: 'function' | 'class' | 'module';
    name: string;
    status: 'exists' | 'renamed' | 'deleted';
  }>;
}