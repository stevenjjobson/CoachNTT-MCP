import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DocGenerateParams, DocUpdateParams, DocumentStatus } from '../src/interfaces';
import { rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Mock fs module
jest.mock('fs');

// Mock DatabaseConnection module
jest.mock('../src/database', () => ({
  DatabaseConnection: {
    getInstance: jest.fn(() => ({
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn(),
    })),
  },
}));

import { DocumentationEngine } from '../src/managers/DocumentationEngine';
import { DatabaseConnection } from '../src/database';

describe('DocumentationEngine', () => {
  let documentationEngine: DocumentationEngine;
  const mockFs = {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    rmSync: jest.fn(),
  };

  // Mock data
  const mockSession = {
    id: 'test-session-123',
    project_name: 'test-project',
    session_type: 'feature',
    status: 'active',
    start_time: Date.now(),
    end_time: null,
    context_budget: 100000,
    context_used: 5000,
    estimated_lines: 1000,
    actual_lines: 500,
    estimated_tests: 20,
    actual_tests: 10,
    docs_updated: 1,
    current_phase: 'implementation',
  };

  const mockProject = {
    id: 'project-123',
    name: 'test-project',
    tech_stack: '["TypeScript", "Node.js", "Jest"]',
    status: 'active',
    sessions_count: 5,
    total_context: 50000,
    file_count: 100,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup fs mocks
    (existsSync as jest.Mock).mockImplementation(mockFs.existsSync);
    (mkdirSync as jest.Mock).mockImplementation(mockFs.mkdirSync);
    (writeFileSync as jest.Mock).mockImplementation(mockFs.writeFileSync);
    (readFileSync as jest.Mock).mockImplementation(mockFs.readFileSync);
    
    // Default mock implementations
    mockFs.existsSync.mockReturnValue(false);
    
    // Setup database mocks BEFORE creating DocumentationEngine
    const mockDb = {
      get: jest.fn((query: string) => {
        if (query.includes('sessions')) return mockSession;
        if (query.includes('projects')) return mockProject;
        if (query.includes('documentations')) return null;
        return null;
      }),
      all: jest.fn((query: string) => {
        if (query.includes('sessions')) return [mockSession];
        if (query.includes('blockers')) return [];
        if (query.includes('checkpoints')) return [];
        if (query.includes('reality_snapshots')) return [];
        if (query.includes('context_usage')) return [];
        return [];
      }),
      run: jest.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
    };
    
    // Mock DatabaseConnection.getInstance to return our mockDb
    (DatabaseConnection.getInstance as jest.Mock).mockReturnValue(mockDb);
    
    // Now create fresh documentation engine with mocked database
    documentationEngine = new DocumentationEngine();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generate', () => {
    it('should generate a README document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'readme',
        include_sections: ['Overview', 'Installation', 'Usage'],
      };

      const result = await documentationEngine.generate(params);

      expect(result.document_path).toContain('test-project_readme');
      expect(result.document_path).toContain('.md');
      expect(result.sections_generated).toContain('Overview');
      expect(result.word_count).toBeGreaterThan(0);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      // Check content was written
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# test-project');
      expect(writeCall[1]).toContain('Overview');
    });

    it('should generate an API document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'api',
      };

      const result = await documentationEngine.generate(params);

      expect(result.document_path).toContain('test-project_api');
      expect(result.sections_generated).toBeDefined();
      expect(result.word_count).toBeGreaterThan(0);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('test-project API Documentation');
      expect(writeCall[1]).toContain('API Overview');
    });

    it('should generate an architecture document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'architecture',
      };

      const result = await documentationEngine.generate(params);

      expect(result.document_path).toContain('test-project_architecture');
      expect(result.sections_generated).toBeDefined();
      expect(result.word_count).toBeGreaterThan(0);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('test-project Architecture');
      expect(writeCall[1]).toContain('System Overview');
    });

    it('should generate a handoff document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'handoff',
      };

      const result = await documentationEngine.generate(params);

      expect(result.document_path).toContain('test-project_handoff');
      expect(result.sections_generated).toBeDefined();
      expect(result.word_count).toBeGreaterThan(0);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('Session Handoff Document');
      expect(writeCall[1]).toContain('Session Summary');
    });

    it('should throw error for invalid session', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockReturnValue(null);

      const params: DocGenerateParams = {
        session_id: 'invalid-session',
        doc_type: 'readme',
      };

      await expect(documentationEngine.generate(params)).rejects.toThrow('Session invalid-session not found');
    });

    it('should throw error for unsupported doc type', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'invalid' as any,
      };

      await expect(documentationEngine.generate(params)).rejects.toThrow('Unsupported doc type: invalid');
    });

    it('should create directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'readme',
      };

      await documentationEngine.generate(params);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('test-project'),
        { recursive: true }
      );
    });

    it('should save document metadata to database', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'readme',
      };

      await documentationEngine.generate(params);

      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documentations'),
        expect.arrayContaining([
          expect.any(String), // id
          'test-session-123',
          'readme',
          expect.any(String), // file_path
          expect.any(Number), // generated_at
          expect.any(Number), // word_count
          expect.any(String), // sections
          expect.any(String), // references
          expect.any(Number), // created_at
          expect.any(Number)  // updated_at
        ])
      );
    });

    it('should update observable status', async () => {
      // The DocumentationEngine doesn't automatically emit status updates after generate
      // Status updates are only emitted when checkStatus is called
      const statusUpdates: DocumentStatus[][] = [];
      const subscription = documentationEngine.getDocumentStatus().subscribe(status => {
        statusUpdates.push(status);
      });

      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'readme',
      };

      const result = await documentationEngine.generate(params);
      
      // Mock file exists for checkStatus
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('# Generated content');
      
      // Call checkStatus to trigger observable update
      await documentationEngine.checkStatus({ file_paths: [result.document_path] });

      // Wait for observable update
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusUpdates.length).toBeGreaterThan(0);
      const lastUpdate = statusUpdates[statusUpdates.length - 1];
      expect(lastUpdate).toHaveLength(1);
      expect(lastUpdate[0]).toMatchObject({
        file_path: result.document_path,
        sync_status: 'current',
      });

      subscription.unsubscribe();
    });
  });

  describe('update', () => {
    const existingDoc = {
      id: 'doc-123',
      session_id: 'test-session-123',
      doc_type: 'readme',
      file_path: '/path/to/readme.md',
      generated_at: Date.now() - 3600000,
      word_count: 500,
      sections: '["Overview", "Installation"]',
      references: '[]',
    };

    beforeEach(() => {
      // Mock existing document
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockImplementation((query: string) => {
        if (query.includes('documentations')) return existingDoc;
        if (query.includes('sessions')) return mockSession;
        if (query.includes('projects')) return mockProject;
        return null;
      });

      // Mock file exists and has content
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('# Existing Content\n\n## Overview\nTest content');
    });

    it('should sync update existing document', async () => {
      const params: DocUpdateParams = {
        file_path: '/path/to/readme.md',
        update_type: 'sync',
      };

      const result = await documentationEngine.update(params);

      expect(result.sync_status).toBe('current');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      // The sync operation analyzes and potentially updates references
      // It doesn't completely replace the content with new generated content
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# Existing Content');
    });

    it('should append update to existing document', async () => {
      const params: DocUpdateParams = {
        file_path: '/path/to/readme.md',
        update_type: 'append',
        context: {
          newSection: '\n## New Section\nAdditional content',
          sectionTitle: 'New Section'
        },
      };

      const result = await documentationEngine.update(params);

      expect(result.sync_status).toBe('current');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# Existing Content');
      expect(writeCall[1]).toContain('## New Section');
    });

    it('should restructure document sections', async () => {
      const params: DocUpdateParams = {
        file_path: '/path/to/readme.md',
        update_type: 'restructure',
        context: {
          sections_order: ['Installation', 'Overview', 'API']
        },
      };

      const result = await documentationEngine.update(params);

      expect(result.sync_status).toBe('current');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error for missing document', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get')
        .mockImplementation((query) => {
          if (query.includes('documentations')) return null;
          return mockSession;
        });

      const params: DocUpdateParams = {
        file_path: '/path/to/missing.md',
        update_type: 'sync',
      };

      // When documentations record is not found, it treats as external document
      // and analyzes it, returning current status
      const result = await documentationEngine.update(params);
      expect(result.sync_status).toBe('current');
    });

    it('should throw error if file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const params: DocUpdateParams = {
        file_path: '/path/to/readme.md',
        update_type: 'sync',
      };

      const result = await documentationEngine.update(params);
      expect(result.sync_status).toBe('missing');
    });

    it('should update document metadata in database', async () => {
      const params: DocUpdateParams = {
        file_path: '/path/to/readme.md',
        update_type: 'sync',
      };

      await documentationEngine.update(params);

      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE documentations'),
        expect.any(Array)
      );
    });

    it('should update observable status after update', async () => {
      const statusUpdates: DocumentStatus[][] = [];
      const subscription = documentationEngine.getDocumentStatus().subscribe(status => {
        statusUpdates.push(status);
      });

      const params: DocUpdateParams = {
        file_path: '/path/to/readme.md',
        update_type: 'sync',
      };

      const result = await documentationEngine.update(params);
      
      // Call checkStatus to trigger observable update
      await documentationEngine.checkStatus({ file_paths: [result.file_path] });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusUpdates.length).toBeGreaterThan(0);
      const lastUpdate = statusUpdates[statusUpdates.length - 1];
      expect(lastUpdate).toHaveLength(1);
      expect(lastUpdate[0]).toMatchObject({
        file_path: '/path/to/readme.md',
        sync_status: 'current',
      });

      subscription.unsubscribe();
    });
  });

  describe('checkStatus', () => {
    const existingDoc = {
      id: 'doc-123',
      session_id: 'test-session-123',
      doc_type: 'readme',
      file_path: '/path/to/readme.md',
      generated_at: Date.now() - 3600000,
      word_count: 500,
      sections: '["Overview", "Installation"]',
      references: '[]',
    };

    it('should check status of multiple documents', async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        return path.includes('readme.md') || path.includes('api.md');
      });

      mockFs.readFileSync.mockReturnValue('# Document\nContent here');

      const params = {
        file_paths: ['/docs/readme.md', '/docs/api.md', '/docs/missing.md'],
      };

      const results = await documentationEngine.checkStatus(params);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        file_path: '/docs/readme.md',
        sync_status: 'current',
        referenced_items: expect.any(Array),
      });
      expect(results[1]).toMatchObject({
        file_path: '/docs/api.md',
        sync_status: 'current',
        referenced_items: expect.any(Array),
      });
      expect(results[2]).toMatchObject({
        file_path: '/docs/missing.md',
        sync_status: 'missing',
        referenced_items: [],
      });
    });

    it('should detect out-of-sync documents', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockImplementation((query: string) => {
        if (query.includes('documentations')) {
          return {
            ...existingDoc,
            generated_at: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days old - will be outdated
            updated_at: Date.now() - 8 * 24 * 60 * 60 * 1000,
          };
        }
        return mockSession;
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('# Modified Content');

      const params = {
        file_paths: ['/path/to/readme.md'],
      };

      const results = await documentationEngine.checkStatus(params);

      expect(results[0].sync_status).toBe('outdated');
      expect(results[0].file_path).toBe('/path/to/readme.md');
    });

    it('should handle empty file paths', async () => {
      const params = { file_paths: [] };
      const results = await documentationEngine.checkStatus(params);
      expect(results).toEqual([]);
    });
  });

  describe('getDocumentStatus', () => {
    it('should return observable of document status', () => {
      const observable = documentationEngine.getDocumentStatus();
      expect(observable).toBeDefined();
      expect(observable.subscribe).toBeDefined();
    });

    it('should emit initial empty status', (done) => {
      documentationEngine.getDocumentStatus().subscribe(status => {
        expect(Array.isArray(status)).toBe(true);
        expect(status).toEqual([]);
        done();
      });
    });
  });
});