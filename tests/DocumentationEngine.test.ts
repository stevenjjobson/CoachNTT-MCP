import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DocumentationEngine } from '../src/managers/DocumentationEngine';
import { DatabaseConnection } from '../src/database';
import { DocGenerateParams, DocUpdateParams, DocumentStatus } from '../src/interfaces';
import { rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { setupTestDatabase, cleanupTestDatabase } from './helpers/database';

// Mock fs module
jest.mock('fs');

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
    started_at: Date.now(),
    context_budget: 100000,
    context_used: 5000,
    progress: {
      completed_files: 10,
      test_files: 5,
      documentation_files: 2,
    },
  };

  const mockProject = {
    id: 'project-123',
    name: 'test-project',
    tech_stack: 'TypeScript, Node.js, Jest',
    status: 'active',
    sessions_count: 5,
    total_context: 50000,
    file_count: 100,
  };

  beforeEach(() => {
    // Setup test database
    setupTestDatabase();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup fs mocks
    (existsSync as jest.Mock).mockImplementation(mockFs.existsSync);
    (mkdirSync as jest.Mock).mockImplementation(mockFs.mkdirSync);
    (writeFileSync as jest.Mock).mockImplementation(mockFs.writeFileSync);
    (readFileSync as jest.Mock).mockImplementation(mockFs.readFileSync);
    
    // Default mock implementations
    mockFs.existsSync.mockReturnValue(false);
    
    // Create fresh documentation engine
    documentationEngine = new DocumentationEngine();

    // Setup database mocks
    const dbMock = DatabaseConnection.getInstance();
    jest.spyOn(dbMock, 'get').mockImplementation((query: string) => {
      if (query.includes('sessions')) return mockSession;
      if (query.includes('projects')) return mockProject;
      if (query.includes('documentations')) return null;
      return null;
    });

    jest.spyOn(dbMock, 'all').mockImplementation((query: string) => {
      if (query.includes('sessions')) return [mockSession];
      if (query.includes('blockers')) return [];
      if (query.includes('context_snapshots')) return [];
      return [];
    });

    jest.spyOn(dbMock, 'run').mockImplementation(() => ({ lastInsertRowid: 1, changes: 1 }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    cleanupTestDatabase();
  });

  describe('generate', () => {
    it('should generate a README document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'readme',
        include_sections: ['overview', 'installation', 'usage'],
      };

      const result = await documentationEngine.generate(params);

      expect(result.success).toBe(true);
      expect(result.file_path).toContain('test-project_readme');
      expect(result.file_path).toContain('.md');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      // Check content was written
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# test-project');
      expect(writeCall[1]).toContain('## Overview');
    });

    it('should generate an API document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'api',
      };

      const result = await documentationEngine.generate(params);

      expect(result.success).toBe(true);
      expect(result.file_path).toContain('test-project_api');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# API Reference');
      expect(writeCall[1]).toContain('test-project');
    });

    it('should generate an architecture document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'architecture',
      };

      const result = await documentationEngine.generate(params);

      expect(result.success).toBe(true);
      expect(result.file_path).toContain('test-project_architecture');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# Architecture Document');
      expect(writeCall[1]).toContain('## System Overview');
    });

    it('should generate a handoff document', async () => {
      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'handoff',
      };

      const result = await documentationEngine.generate(params);

      expect(result.success).toBe(true);
      expect(result.file_path).toContain('test-project_handoff');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# Handoff Document');
      expect(writeCall[1]).toContain('## Project State');
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
        expect.any(String), // id
        'test-session-123',
        'readme',
        expect.any(String), // file_path
        expect.any(Number), // generated_at
        expect.any(Number), // word_count
        expect.any(String), // sections
        expect.any(String)  // references
      );
    });

    it('should update observable status', async () => {
      const statusUpdates: DocumentStatus[][] = [];
      const subscription = documentationEngine.getDocumentStatus().subscribe(status => {
        statusUpdates.push(status);
      });

      const params: DocGenerateParams = {
        session_id: 'test-session-123',
        doc_type: 'readme',
      };

      await documentationEngine.generate(params);

      // Wait for observable update
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusUpdates.length).toBeGreaterThan(0);
      const lastUpdate = statusUpdates[statusUpdates.length - 1];
      expect(lastUpdate).toContainEqual(expect.objectContaining({
        doc_type: 'readme',
        in_sync: true,
      }));

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
        doc_id: 'doc-123',
        update_mode: 'sync',
      };

      const result = await documentationEngine.update(params);

      expect(result.in_sync).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      // Should completely replace content
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# test-project');
    });

    it('should append update to existing document', async () => {
      const params: DocUpdateParams = {
        doc_id: 'doc-123',
        update_mode: 'append',
        custom_content: '\n## New Section\nAdditional content',
      };

      const result = await documentationEngine.update(params);

      expect(result.in_sync).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = (writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('# Existing Content');
      expect(writeCall[1]).toContain('## New Section');
    });

    it('should restructure document sections', async () => {
      const params: DocUpdateParams = {
        doc_id: 'doc-123',
        update_mode: 'restructure',
        sections_order: ['Installation', 'Overview', 'API'],
      };

      const result = await documentationEngine.update(params);

      expect(result.in_sync).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error for missing document', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get')
        .mockImplementation((query) => {
          if (query.includes('documentations')) return null;
          return mockSession;
        });

      const params: DocUpdateParams = {
        doc_id: 'missing-doc',
        update_mode: 'sync',
      };

      await expect(documentationEngine.update(params)).rejects.toThrow('Document missing-doc not found');
    });

    it('should throw error if file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const params: DocUpdateParams = {
        doc_id: 'doc-123',
        update_mode: 'sync',
      };

      await expect(documentationEngine.update(params)).rejects.toThrow('Document file not found');
    });

    it('should update document metadata in database', async () => {
      const params: DocUpdateParams = {
        doc_id: 'doc-123',
        update_mode: 'sync',
      };

      await documentationEngine.update(params);

      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE documentations'),
        expect.any(Number), // updated_at
        expect.any(Number), // word_count
        expect.any(String), // sections
        'doc-123'
      );
    });

    it('should update observable status after update', async () => {
      const statusUpdates: DocumentStatus[][] = [];
      const subscription = documentationEngine.getDocumentStatus().subscribe(status => {
        statusUpdates.push(status);
      });

      const params: DocUpdateParams = {
        doc_id: 'doc-123',
        update_mode: 'sync',
      };

      await documentationEngine.update(params);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusUpdates.length).toBeGreaterThan(0);
      const lastUpdate = statusUpdates[statusUpdates.length - 1];
      expect(lastUpdate).toContainEqual(expect.objectContaining({
        doc_type: 'readme',
        in_sync: true,
      }));

      subscription.unsubscribe();
    });
  });

  describe('checkStatus', () => {
    it('should check status of multiple documents', async () => {
      mockFs.existsSync.mockImplementation((path) => {
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
        exists: true,
        in_sync: true,
      });
      expect(results[1]).toMatchObject({
        file_path: '/docs/api.md',
        exists: true,
        in_sync: true,
      });
      expect(results[2]).toMatchObject({
        file_path: '/docs/missing.md',
        exists: false,
        in_sync: false,
      });
    });

    it('should detect out-of-sync documents', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockImplementation((query) => {
        if (query.includes('documentations')) {
          return {
            ...existingDoc,
            generated_at: Date.now() - 7200000, // 2 hours old
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

      expect(results[0].in_sync).toBe(false);
      expect(results[0].sync_message).toContain('outdated');
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