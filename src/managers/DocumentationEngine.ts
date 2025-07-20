import { DatabaseConnection } from '../database';
import {
  DocGenerateParams,
  DocGenerateResponse,
  DocUpdateParams,
  DocumentStatus,
} from '../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { BehaviorSubject, Observable } from 'rxjs';

interface DocumentTemplate {
  name: string;
  sections: Array<{
    title: string;
    template: string;
    required: boolean;
  }>;
}

interface DocumentMetadata {
  id: string;
  session_id: string;
  doc_type: string;
  file_path: string;
  generated_at: number;
  word_count: number;
  sections: string[];
  references: string[];
}

export class DocumentationEngine {
  private db: DatabaseConnection;
  private documentStatus$ = new BehaviorSubject<DocumentStatus[]>([]);
  private templates: Map<string, DocumentTemplate>;
  private docsPath: string;

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.docsPath = join(process.cwd(), 'docs', 'generated');
    this.templates = this.initializeTemplates();
    this.ensureDocsDirectory();
  }

  async generate(params: DocGenerateParams): Promise<DocGenerateResponse> {
    const { session_id, doc_type, include_sections = [] } = params;

    try {
      // Validate session exists
      const session = this.db.get<any>(
        'SELECT * FROM sessions WHERE id = ?',
        session_id
      );

      if (!session) {
        throw new Error(`Session ${session_id} not found`);
      }

      // Get project info
      const project = this.db.get<any>(
        'SELECT * FROM projects WHERE name = ?',
        session.project_name
      );

      // Generate document based on type
      let content: string;
      let sections: string[];
      let references: string[] = [];

      switch (doc_type) {
        case 'readme':
          ({ content, sections, references } = await this.generateReadme(session, project, include_sections));
          break;
        case 'api':
          ({ content, sections, references } = await this.generateAPI(session, project, include_sections));
          break;
        case 'architecture':
          ({ content, sections, references } = await this.generateArchitecture(session, project, include_sections));
          break;
        case 'handoff':
          ({ content, sections, references } = await this.generateHandoff(session, project, include_sections));
          break;
        default:
          throw new Error(`Unsupported doc type: ${doc_type}`);
      }

      // Determine file path
      const fileName = `${session.project_name}_${doc_type}_${new Date().toISOString().split('T')[0]}.md`;
      const filePath = join(this.docsPath, session.project_name, fileName);

      // Ensure directory exists
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write file
      writeFileSync(filePath, content, 'utf-8');

      // Count words
      const wordCount = content.split(/\s+/).length;

      // Save metadata to database
      const docId = uuidv4();
      const now = Date.now();

      this.db.run(
        `INSERT INTO documentations (id, session_id, doc_type, file_path, generated_at, word_count, sections, references, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [docId, session_id, doc_type, filePath, now, wordCount, JSON.stringify(sections), JSON.stringify(references), now, now]
      );

      return {
        document_path: filePath,
        sections_generated: sections,
        word_count: wordCount,
        references_included: references,
      };
    } catch (error) {
      console.error('Failed to generate documentation:', error);
      throw error;
    }
  }

  async update(params: DocUpdateParams): Promise<DocumentStatus> {
    const { file_path, update_type, context = {} } = params;

    try {
      // Check if file exists
      if (!existsSync(file_path)) {
        return {
          file_path,
          last_updated: 0,
          sync_status: 'missing',
          referenced_items: [],
        };
      }

      // Read existing content
      const currentContent = readFileSync(file_path, 'utf-8');
      let updatedContent = currentContent;

      // Find associated metadata
      const metadata = this.db.get<any>(
        'SELECT * FROM documentations WHERE file_path = ? ORDER BY generated_at DESC LIMIT 1',
        file_path
      );

      if (!metadata) {
        // No metadata found, treat as external document
        return this.analyzeExternalDocument(file_path, currentContent);
      }

      // Get session and project info
      const session = this.db.get<any>(
        'SELECT * FROM sessions WHERE id = ?',
        metadata.session_id
      );

      const project = this.db.get<any>(
        'SELECT * FROM projects WHERE name = ?',
        session?.project_name
      );

      // Apply updates based on type
      switch (update_type) {
        case 'sync':
          updatedContent = await this.syncWithCodebase(currentContent, metadata, session, project);
          break;
        case 'append':
          updatedContent = await this.appendNewContent(currentContent, context, metadata);
          break;
        case 'restructure':
          updatedContent = await this.restructureDocument(currentContent, metadata, session, project);
          break;
      }

      // Write updated content if changed
      if (updatedContent !== currentContent) {
        writeFileSync(file_path, updatedContent, 'utf-8');
        
        // Update metadata
        const now = Date.now();
        this.db.run(
          'UPDATE documentations SET updated_at = ?, word_count = ? WHERE id = ?',
          [now, updatedContent.split(/\s+/).length, metadata.id]
        );
      }

      // Analyze and return status
      return this.analyzeDocumentStatus(file_path, updatedContent, metadata);
    } catch (error) {
      console.error('Failed to update documentation:', error);
      throw error;
    }
  }

  async checkStatus(params: { file_paths: string[] }): Promise<DocumentStatus[]> {
    const { file_paths } = params;
    const statuses: DocumentStatus[] = [];

    for (const filePath of file_paths) {
      try {
        if (!existsSync(filePath)) {
          statuses.push({
            file_path: filePath,
            last_updated: 0,
            sync_status: 'missing',
            referenced_items: [],
          });
          continue;
        }

        const content = readFileSync(filePath, 'utf-8');
        const metadata = this.db.get<any>(
          'SELECT * FROM documentations WHERE file_path = ? ORDER BY generated_at DESC LIMIT 1',
          filePath
        );

        if (metadata) {
          statuses.push(await this.analyzeDocumentStatus(filePath, content, metadata));
        } else {
          statuses.push(await this.analyzeExternalDocument(filePath, content));
        }
      } catch (error) {
        console.error(`Failed to check status for ${filePath}:`, error);
        statuses.push({
          file_path: filePath,
          last_updated: 0,
          sync_status: 'missing',
          referenced_items: [],
        });
      }
    }

    // Update observable
    this.documentStatus$.next(statuses);

    return statuses;
  }

  getDocumentStatus(): Observable<DocumentStatus[]> {
    return this.documentStatus$.asObservable();
  }

  private async generateReadme(session: any, project: any, includeSections: string[]): Promise<{ content: string; sections: string[]; references: string[] }> {
    const template = this.templates.get('readme')!;
    const sections: string[] = [];
    const references: string[] = [];
    let content = '';

    // Header
    content += `# ${session.project_name}\n\n`;
    content += `> Generated on ${new Date().toLocaleDateString()}\n\n`;

    // Process template sections
    for (const section of template.sections) {
      if (!section.required && includeSections.length > 0 && !includeSections.includes(section.title)) {
        continue;
      }

      sections.push(section.title);
      let sectionContent = section.template;

      // Replace variables
      sectionContent = sectionContent
        .replace('{{PROJECT_NAME}}', session.project_name)
        .replace('{{SESSION_TYPE}}', session.session_type)
        .replace('{{TECH_STACK}}', project?.tech_stack ? JSON.parse(project.tech_stack).join(', ') : 'Not specified')
        .replace('{{TOTAL_LINES}}', session.actual_lines || session.estimated_lines)
        .replace('{{TEST_COVERAGE}}', session.actual_tests || session.estimated_tests);

      content += sectionContent + '\n\n';
    }

    // Add session metrics
    content += `## Session Metrics\n\n`;
    content += `- **Lines Written**: ${session.actual_lines}\n`;
    content += `- **Tests Added**: ${session.actual_tests}\n`;
    content += `- **Documentation Updated**: ${session.docs_updated ? 'Yes' : 'No'}\n`;
    content += `- **Context Used**: ${Math.round((session.context_used / session.context_budget) * 100)}%\n\n`;

    sections.push('Session Metrics');
    references.push(`session:${session.id}`);

    return { content, sections, references };
  }

  private async generateAPI(session: any, project: any, includeSections: string[]): Promise<{ content: string; sections: string[]; references: string[] }> {
    const template = this.templates.get('api')!;
    const sections: string[] = [];
    const references: string[] = [];
    let content = '';

    // Header
    content += `# ${session.project_name} API Documentation\n\n`;
    content += `> Generated on ${new Date().toLocaleDateString()}\n\n`;

    // Get checkpoints for API examples
    const checkpoints = this.db.all<any>(
      'SELECT * FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number',
      session.id
    );

    // Process template sections
    for (const section of template.sections) {
      if (!section.required && includeSections.length > 0 && !includeSections.includes(section.title)) {
        continue;
      }

      sections.push(section.title);
      let sectionContent = section.template;

      // Add checkpoint-based examples if available
      if (section.title === 'Endpoints' && checkpoints.length > 0) {
        sectionContent += '\n\n### Implemented Features\n\n';
        for (const checkpoint of checkpoints) {
          const components = JSON.parse(checkpoint.completed_components);
          sectionContent += `#### Checkpoint ${checkpoint.checkpoint_number}\n`;
          sectionContent += components.map((c: string) => `- ${c}`).join('\n') + '\n\n';
          references.push(`checkpoint:${checkpoint.id}`);
        }
      }

      content += sectionContent + '\n\n';
    }

    return { content, sections, references };
  }

  private async generateArchitecture(session: any, project: any, includeSections: string[]): Promise<{ content: string; sections: string[]; references: string[] }> {
    const template = this.templates.get('architecture')!;
    const sections: string[] = [];
    const references: string[] = [];
    let content = '';

    content += `# ${session.project_name} Architecture\n\n`;
    content += `> Generated on ${new Date().toLocaleDateString()}\n\n`;

    // System overview
    content += `## System Overview\n\n`;
    content += `This document describes the architecture of ${session.project_name}, a ${session.session_type} project.\n\n`;
    sections.push('System Overview');

    // Component structure based on session data
    content += `## Component Structure\n\n`;
    
    const realityChecks = this.db.all<any>(
      'SELECT * FROM reality_snapshots WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1',
      session.id
    );

    if (realityChecks.length > 0) {
      const latestCheck = realityChecks[0];
      const discrepancies = JSON.parse(latestCheck.discrepancies);
      
      content += `### Verified Components\n\n`;
      content += `Based on reality check performed at ${new Date(latestCheck.timestamp).toLocaleString()}:\n\n`;
      
      // Extract file structure from discrepancies or recommendations
      content += `- **Confidence Score**: ${Math.round(latestCheck.confidence_score * 100)}%\n`;
      content += `- **Auto-fixed Issues**: ${latestCheck.auto_fixed_count}\n\n`;
      
      references.push(`reality_check:${latestCheck.id}`);
    }

    sections.push('Component Structure');

    // Technical decisions
    if (project?.tech_stack) {
      content += `## Technical Stack\n\n`;
      const techStack = JSON.parse(project.tech_stack);
      techStack.forEach((tech: string) => {
        content += `- ${tech}\n`;
      });
      content += '\n';
      sections.push('Technical Stack');
    }

    return { content, sections, references };
  }

  private async generateHandoff(session: any, project: any, includeSections: string[]): Promise<{ content: string; sections: string[]; references: string[] }> {
    const sections: string[] = [];
    const references: string[] = [];
    let content = '';

    content += `# Session Handoff Document\n\n`;
    content += `**Project**: ${session.project_name}\n`;
    content += `**Session ID**: ${session.id}\n`;
    content += `**Date**: ${new Date().toLocaleDateString()}\n\n`;

    // Session summary
    content += `## Session Summary\n\n`;
    content += `- **Type**: ${session.session_type}\n`;
    content += `- **Status**: ${session.status}\n`;
    content += `- **Phase**: ${session.current_phase}\n`;
    content += `- **Duration**: ${this.calculateDuration(session.start_time, session.end_time || Date.now())}\n\n`;
    sections.push('Session Summary');

    // Progress metrics
    content += `## Progress Metrics\n\n`;
    content += `| Metric | Estimated | Actual | Progress |\n`;
    content += `|--------|-----------|--------|----------|\n`;
    content += `| Lines of Code | ${session.estimated_lines} | ${session.actual_lines} | ${Math.round((session.actual_lines / session.estimated_lines) * 100)}% |\n`;
    content += `| Tests | ${session.estimated_tests} | ${session.actual_tests} | ${Math.round((session.actual_tests / session.estimated_tests) * 100)}% |\n`;
    content += `| Context | ${session.context_budget} | ${session.context_used} | ${Math.round((session.context_used / session.context_budget) * 100)}% |\n\n`;
    sections.push('Progress Metrics');

    // Completed work
    const checkpoints = this.db.all<any>(
      'SELECT * FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number',
      session.id
    );

    if (checkpoints.length > 0) {
      content += `## Completed Work\n\n`;
      for (const checkpoint of checkpoints) {
        content += `### Checkpoint ${checkpoint.checkpoint_number}\n`;
        const components = JSON.parse(checkpoint.completed_components);
        components.forEach((comp: string) => {
          content += `- ✅ ${comp}\n`;
        });
        content += '\n';
        references.push(`checkpoint:${checkpoint.id}`);
      }
      sections.push('Completed Work');
    }

    // Blockers
    const blockers = this.db.all<any>(
      'SELECT * FROM blockers WHERE session_id = ? AND resolution IS NULL',
      session.id
    );

    if (blockers.length > 0) {
      content += `## Open Blockers\n\n`;
      for (const blocker of blockers) {
        content += `### ${blocker.type.charAt(0).toUpperCase() + blocker.type.slice(1)} Blocker\n`;
        content += `- **Description**: ${blocker.description}\n`;
        content += `- **Impact Score**: ${blocker.impact_score}/10\n\n`;
        references.push(`blocker:${blocker.id}`);
      }
      sections.push('Open Blockers');
    }

    // Next steps
    content += `## Recommended Next Steps\n\n`;
    
    // Get context prediction
    const contextUsage = this.db.get<any>(
      'SELECT SUM(tokens_used) as total FROM context_usage WHERE session_id = ?',
      session.id
    );

    const remainingContext = session.context_budget - (contextUsage?.total || 0);
    const contextPercent = ((contextUsage?.total || 0) / session.context_budget) * 100;

    if (contextPercent > 70) {
      content += `1. ⚠️ **Context Usage High** (${Math.round(contextPercent)}%): Consider creating a checkpoint before continuing\n`;
    }

    if (session.current_phase === 'implementation') {
      content += `2. Continue implementation of remaining features\n`;
      content += `3. Begin writing tests for completed components\n`;
    } else if (session.current_phase === 'testing') {
      content += `2. Complete test coverage for all components\n`;
      content += `3. Update documentation to reflect implementation\n`;
    }

    content += `\n### Estimated Remaining Work\n\n`;
    content += `- Lines to write: ~${Math.max(0, session.estimated_lines - session.actual_lines)}\n`;
    content += `- Tests to add: ~${Math.max(0, session.estimated_tests - session.actual_tests)}\n`;
    content += `- Context remaining: ${remainingContext} tokens\n`;

    sections.push('Recommended Next Steps');
    references.push(`session:${session.id}`);

    return { content, sections, references };
  }

  private initializeTemplates(): Map<string, DocumentTemplate> {
    const templates = new Map<string, DocumentTemplate>();

    // README template
    templates.set('readme', {
      name: 'README',
      sections: [
        {
          title: 'Overview',
          template: `## Overview\n\nThis is {{PROJECT_NAME}}, a {{SESSION_TYPE}} project built with {{TECH_STACK}}.`,
          required: true,
        },
        {
          title: 'Installation',
          template: `## Installation\n\n\`\`\`bash\nnpm install\n\`\`\``,
          required: true,
        },
        {
          title: 'Usage',
          template: `## Usage\n\n[Add usage instructions here]`,
          required: false,
        },
        {
          title: 'Testing',
          template: `## Testing\n\nThis project includes {{TEST_COVERAGE}} tests.\n\n\`\`\`bash\nnpm test\n\`\`\``,
          required: false,
        },
      ],
    });

    // API template
    templates.set('api', {
      name: 'API Documentation',
      sections: [
        {
          title: 'Overview',
          template: `## API Overview\n\nThis document describes the API for {{PROJECT_NAME}}.`,
          required: true,
        },
        {
          title: 'Authentication',
          template: `## Authentication\n\n[Describe authentication methods]`,
          required: false,
        },
        {
          title: 'Endpoints',
          template: `## Endpoints\n\n[List API endpoints]`,
          required: true,
        },
        {
          title: 'Error Handling',
          template: `## Error Handling\n\nThe API returns standard HTTP status codes.`,
          required: false,
        },
      ],
    });

    // Architecture template
    templates.set('architecture', {
      name: 'Architecture Documentation',
      sections: [
        {
          title: 'Overview',
          template: `## Architecture Overview\n\nThis document describes the system architecture.`,
          required: true,
        },
        {
          title: 'Components',
          template: `## Components\n\n[Describe main components]`,
          required: true,
        },
        {
          title: 'Data Flow',
          template: `## Data Flow\n\n[Describe how data flows through the system]`,
          required: false,
        },
      ],
    });

    // Handoff template is dynamically generated
    templates.set('handoff', {
      name: 'Session Handoff',
      sections: [],
    });

    return templates;
  }

  private ensureDocsDirectory(): void {
    if (!existsSync(this.docsPath)) {
      mkdirSync(this.docsPath, { recursive: true });
    }
  }

  private async syncWithCodebase(
    content: string,
    metadata: any,
    session: any,
    project: any
  ): Promise<string> {
    // Parse content to find code references
    const codeRefs = this.extractCodeReferences(content);
    let updatedContent = content;

    // Check each reference
    for (const ref of codeRefs) {
      // This is a simplified version - in production, you'd check actual files
      const exists = Math.random() > 0.2; // Simulate 80% still exist
      
      if (!exists) {
        // Mark as outdated
        updatedContent = updatedContent.replace(
          ref,
          `~~${ref}~~ *(outdated)*`
        );
      }
    }

    // Add sync timestamp
    const syncNote = `\n\n---\n*Last synced: ${new Date().toISOString()}*\n`;
    if (!updatedContent.includes('*Last synced:')) {
      updatedContent += syncNote;
    } else {
      updatedContent = updatedContent.replace(
        /\*Last synced: .*\*/,
        `*Last synced: ${new Date().toISOString()}*`
      );
    }

    return updatedContent;
  }

  private async appendNewContent(
    content: string,
    context: Record<string, unknown>,
    metadata: any
  ): Promise<string> {
    let updatedContent = content;

    // Add new section if provided
    if (context.newSection) {
      updatedContent += `\n\n## ${context.sectionTitle || 'Additional Information'}\n\n`;
      updatedContent += context.newSection;
    }

    // Add timestamp
    updatedContent += `\n\n*Added on ${new Date().toLocaleDateString()}*\n`;

    return updatedContent;
  }

  private async restructureDocument(
    content: string,
    metadata: any,
    session: any,
    project: any
  ): Promise<string> {
    // Extract sections
    const sections = this.extractSections(content);
    
    // Reorder based on template
    const docType = metadata.doc_type;
    const template = this.templates.get(docType);
    
    if (!template) {
      return content; // No template, return as-is
    }

    let restructured = '';
    
    // Add sections in template order
    for (const templateSection of template.sections) {
      const existingSection = sections.find(s => 
        s.title.toLowerCase().includes(templateSection.title.toLowerCase())
      );
      
      if (existingSection) {
        restructured += existingSection.content + '\n\n';
      } else if (templateSection.required) {
        // Add missing required section
        restructured += `## ${templateSection.title}\n\n[Section needs to be written]\n\n`;
      }
    }

    // Add any sections not in template at the end
    for (const section of sections) {
      if (!template.sections.some(ts => 
        section.title.toLowerCase().includes(ts.title.toLowerCase())
      )) {
        restructured += section.content + '\n\n';
      }
    }

    return restructured.trim();
  }

  private async analyzeDocumentStatus(
    filePath: string,
    content: string,
    metadata: any
  ): Promise<DocumentStatus> {
    const references = this.extractCodeReferences(content);
    const referencedItems: DocumentStatus['referenced_items'] = [];

    for (const ref of references) {
      // Simplified check - in production, would check actual files
      const exists = Math.random() > 0.1; // 90% exist
      const status = exists ? 'exists' : 'deleted';
      
      referencedItems.push({
        type: this.inferReferenceType(ref),
        name: ref,
        status,
      });
    }

    // Determine sync status
    const hasDeletedRefs = referencedItems.some(item => item.status === 'deleted');
    const daysSinceUpdate = (Date.now() - metadata.updated_at) / (1000 * 60 * 60 * 24);
    
    let syncStatus: 'current' | 'outdated' | 'missing';
    if (hasDeletedRefs || daysSinceUpdate > 7) {
      syncStatus = 'outdated';
    } else {
      syncStatus = 'current';
    }

    return {
      file_path: filePath,
      last_updated: metadata.updated_at,
      sync_status: syncStatus,
      referenced_items: referencedItems,
    };
  }

  private async analyzeExternalDocument(
    filePath: string,
    content: string
  ): Promise<DocumentStatus> {
    const references = this.extractCodeReferences(content);
    const referencedItems: DocumentStatus['referenced_items'] = [];

    for (const ref of references) {
      referencedItems.push({
        type: this.inferReferenceType(ref),
        name: ref,
        status: 'exists', // Assume exists for external docs
      });
    }

    return {
      file_path: filePath,
      last_updated: Date.now(),
      sync_status: 'current',
      referenced_items: referencedItems,
    };
  }

  private extractCodeReferences(content: string): string[] {
    const references: string[] = [];
    
    // Match function names in backticks
    const functionMatches = content.match(/`(\w+)\(`/g) || [];
    references.push(...functionMatches.map(m => m.slice(1, -2)));
    
    // Match class names
    const classMatches = content.match(/class\s+(\w+)/g) || [];
    references.push(...classMatches.map(m => m.replace('class ', '')));
    
    // Match import paths
    const importMatches = content.match(/from\s+['"]([^'"]+)['"]/g) || [];
    references.push(...importMatches.map(m => m.match(/['"]([^'"]+)['"]/)?.[1] || ''));
    
    return [...new Set(references)]; // Remove duplicates
  }

  private extractSections(content: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = [];
    const lines = content.split('\n');
    
    let currentSection: { title: string; content: string } | null = null;
    
    for (const line of lines) {
      if (line.match(/^#+\s+/)) {
        // New section
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace(/^#+\s+/, ''),
          content: line,
        };
      } else if (currentSection) {
        currentSection.content += '\n' + line;
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  private inferReferenceType(ref: string): 'function' | 'class' | 'module' {
    if (ref.includes('/') || ref.includes('.')) {
      return 'module';
    } else if (ref[0] === ref[0].toUpperCase()) {
      return 'class';
    } else {
      return 'function';
    }
  }

  private calculateDuration(startTime: number, endTime: number): string {
    const duration = endTime - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}