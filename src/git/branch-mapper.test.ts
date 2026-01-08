/**
 * Tests for Git branch mapper
 */

import fs from 'fs/promises';
import path from 'path';
import { BranchMapper, BranchMapperConfig } from './branch-mapper';

describe('BranchMapper', () => {
  let branchMapper: BranchMapper;
  let config: BranchMapperConfig;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test storage
    tempDir = path.join(__dirname, '../../test-data', `branch-mapper-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    config = {
      storageFile: path.join(tempDir, 'branch-mappings.json'),
    };
    
    branchMapper = new BranchMapper(config);
    await branchMapper.initialize();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('branch name sanitization', () => {
    it('should sanitize branch names for AWS compatibility', () => {
      expect(branchMapper.sanitizeBranchName('feature/user-auth')).toBe('feature-user-auth');
      expect(branchMapper.sanitizeBranchName('FEATURE/USER_AUTH')).toBe('feature-user-auth');
      expect(branchMapper.sanitizeBranchName('fix/bug#123')).toBe('fix-bug-123');
      expect(branchMapper.sanitizeBranchName('---test---')).toBe('test');
    });

    it('should limit branch name length', () => {
      const longBranch = 'a'.repeat(100);
      const sanitized = branchMapper.sanitizeBranchName(longBranch);
      expect(sanitized.length).toBeLessThanOrEqual(50);
    });
  });

  describe('environment name generation', () => {
    it('should generate unique environment names', () => {
      const name1 = branchMapper.generateEnvironmentName('test-branch');
      // Add a small delay to ensure different timestamps
      const name2 = branchMapper.generateEnvironmentName('test-branch');
      
      expect(name1).toMatch(/^ephemeral-test-branch-/);
      expect(name2).toMatch(/^ephemeral-test-branch-/);
      // Names should have the same prefix but different suffixes due to timestamp
      expect(name1.startsWith('ephemeral-test-branch-')).toBe(true);
      expect(name2.startsWith('ephemeral-test-branch-')).toBe(true);
    });
  });

  describe('mapping management', () => {
    it('should create and retrieve mappings', async () => {
      const mapping = await branchMapper.createMapping('test-branch', 'env-123');
      
      expect(mapping.branch).toBe('test-branch');
      expect(mapping.environmentId).toBe('env-123');
      expect(mapping.status).toBe('active');
      
      const retrieved = branchMapper.getMapping('test-branch');
      expect(retrieved).toEqual(mapping);
    });

    it('should update mapping status', async () => {
      await branchMapper.createMapping('test-branch', 'env-123');
      await branchMapper.updateMappingStatus('test-branch', 'cleanup_scheduled');
      
      const mapping = branchMapper.getMapping('test-branch');
      expect(mapping?.status).toBe('cleanup_scheduled');
    });

    it('should remove mappings', async () => {
      await branchMapper.createMapping('test-branch', 'env-123');
      await branchMapper.removeMapping('test-branch');
      
      const mapping = branchMapper.getMapping('test-branch');
      expect(mapping).toBeUndefined();
    });
  });

  describe('mapping queries', () => {
    beforeEach(async () => {
      await branchMapper.createMapping('active-branch', 'env-1');
      await branchMapper.createMapping('scheduled-branch', 'env-2');
      await branchMapper.updateMappingStatus('scheduled-branch', 'cleanup_scheduled');
    });

    it('should get active mappings', () => {
      const active = branchMapper.getActiveMappings();
      expect(active).toHaveLength(1);
      expect(active[0]?.branch).toBe('active-branch');
    });

    it('should get mappings by status', () => {
      const scheduled = branchMapper.getMappingsByStatus('cleanup_scheduled');
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0]?.branch).toBe('scheduled-branch');
    });

    it('should get mapping by environment ID', () => {
      const mapping = branchMapper.getMappingByEnvironmentId('env-1');
      expect(mapping?.branch).toBe('active-branch');
    });
  });

  describe('persistence', () => {
    it('should persist mappings to file', async () => {
      await branchMapper.createMapping('test-branch', 'env-123');
      
      // Create new mapper instance to test loading
      const newMapper = new BranchMapper(config);
      await newMapper.initialize();
      
      const mapping = newMapper.getMapping('test-branch');
      expect(mapping?.environmentId).toBe('env-123');
    });
  });

  describe('cleanup', () => {
    it('should cleanup old destroyed mappings', async () => {
      // Create old mapping
      await branchMapper.createMapping('old-branch', 'env-old');
      await branchMapper.updateMappingStatus('old-branch', 'destroyed');
      
      // Manually set old creation date
      const mapping = branchMapper.getMapping('old-branch');
      if (mapping) {
        mapping.createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      }
      
      const cleaned = await branchMapper.cleanupDestroyedMappings(7);
      expect(cleaned).toBe(1);
      
      const retrieved = branchMapper.getMapping('old-branch');
      expect(retrieved).toBeUndefined();
    });
  });
});