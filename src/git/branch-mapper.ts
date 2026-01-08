/**
 * Branch mapper for managing Git branch to environment relationships
 * Handles branch name sanitization and environment mapping
 */

import fs from 'fs/promises';
import path from 'path';
import { BranchMapping } from '../types';

export interface BranchMapperConfig {
  /** File path for storing branch mappings */
  storageFile: string;
}

/**
 * Branch mapper class for managing branch-to-environment relationships
 */
export class BranchMapper {
  private config: BranchMapperConfig;
  private mappings: Map<string, BranchMapping>;
  private initialized: boolean = false;

  constructor(config: BranchMapperConfig) {
    this.config = config;
    this.mappings = new Map();
  }

  /**
   * Initialize the branch mapper by loading existing mappings
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure the storage directory exists
      const storageDir = path.dirname(this.config.storageFile);
      await fs.mkdir(storageDir, { recursive: true });

      // Load existing mappings if file exists
      try {
        const data = await fs.readFile(this.config.storageFile, 'utf-8');
        const mappingsArray: BranchMapping[] = JSON.parse(data);
        
        for (const mapping of mappingsArray) {
          // Convert date strings back to Date objects
          mapping.createdAt = new Date(mapping.createdAt);
          this.mappings.set(mapping.branch, mapping);
        }
        
        console.log(`Loaded ${mappingsArray.length} branch mappings`);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty mappings
        console.log('No existing branch mappings found, starting fresh');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize branch mapper:', error);
      throw error;
    }
  }

  /**
   * Sanitize branch name for use in AWS resource naming
   * AWS resource names have specific requirements (alphanumeric, hyphens, limited length)
   */
  public sanitizeBranchName(branchName: string): string {
    return branchName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length to 50 characters
  }

  /**
   * Generate environment name from branch name
   */
  public generateEnvironmentName(branchName: string): string {
    const sanitized = this.sanitizeBranchName(branchName);
    const timestamp = Date.now().toString(36); // Base36 timestamp for uniqueness
    return `ephemeral-${sanitized}-${timestamp}`;
  }

  /**
   * Create a new branch mapping
   */
  public async createMapping(branch: string, environmentId: string): Promise<BranchMapping> {
    this.ensureInitialized();

    const mapping: BranchMapping = {
      branch,
      environmentId,
      createdAt: new Date(),
      status: 'active',
    };

    this.mappings.set(branch, mapping);
    await this.persistMappings();

    console.log(`Created branch mapping: ${branch} -> ${environmentId}`);
    return mapping;
  }

  /**
   * Get mapping for a specific branch
   */
  public getMapping(branch: string): BranchMapping | undefined {
    this.ensureInitialized();
    return this.mappings.get(branch);
  }

  /**
   * Get mapping by environment ID
   */
  public getMappingByEnvironmentId(environmentId: string): BranchMapping | undefined {
    this.ensureInitialized();
    
    for (const mapping of this.mappings.values()) {
      if (mapping.environmentId === environmentId) {
        return mapping;
      }
    }
    
    return undefined;
  }

  /**
   * Update mapping status
   */
  public async updateMappingStatus(branch: string, status: BranchMapping['status']): Promise<void> {
    this.ensureInitialized();

    const mapping = this.mappings.get(branch);
    if (mapping) {
      mapping.status = status;
      await this.persistMappings();
      console.log(`Updated branch mapping status: ${branch} -> ${status}`);
    } else {
      throw new Error(`No mapping found for branch: ${branch}`);
    }
  }

  /**
   * Remove a branch mapping
   */
  public async removeMapping(branch: string): Promise<void> {
    this.ensureInitialized();

    if (this.mappings.delete(branch)) {
      await this.persistMappings();
      console.log(`Removed branch mapping: ${branch}`);
    } else {
      console.warn(`No mapping found to remove for branch: ${branch}`);
    }
  }

  /**
   * Get all active mappings
   */
  public getActiveMappings(): BranchMapping[] {
    this.ensureInitialized();
    
    return Array.from(this.mappings.values()).filter(
      mapping => mapping.status === 'active'
    );
  }

  /**
   * Get all mappings with a specific status
   */
  public getMappingsByStatus(status: BranchMapping['status']): BranchMapping[] {
    this.ensureInitialized();
    
    return Array.from(this.mappings.values()).filter(
      mapping => mapping.status === status
    );
  }

  /**
   * Get all mappings
   */
  public getAllMappings(): BranchMapping[] {
    this.ensureInitialized();
    return Array.from(this.mappings.values());
  }

  /**
   * Clean up old destroyed mappings
   */
  public async cleanupDestroyedMappings(olderThanDays: number = 7): Promise<number> {
    this.ensureInitialized();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const toRemove: string[] = [];
    
    for (const [branch, mapping] of this.mappings.entries()) {
      if (mapping.status === 'destroyed' && mapping.createdAt < cutoffDate) {
        toRemove.push(branch);
      }
    }

    for (const branch of toRemove) {
      this.mappings.delete(branch);
    }

    if (toRemove.length > 0) {
      await this.persistMappings();
      console.log(`Cleaned up ${toRemove.length} old destroyed mappings`);
    }

    return toRemove.length;
  }

  /**
   * Persist mappings to storage file
   */
  private async persistMappings(): Promise<void> {
    try {
      const mappingsArray = Array.from(this.mappings.values());
      const data = JSON.stringify(mappingsArray, null, 2);
      await fs.writeFile(this.config.storageFile, data, 'utf-8');
    } catch (error) {
      console.error('Failed to persist branch mappings:', error);
      throw error;
    }
  }

  /**
   * Ensure the mapper is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('BranchMapper not initialized. Call initialize() first.');
    }
  }
}