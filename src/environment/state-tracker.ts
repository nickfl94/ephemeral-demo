/**
 * Environment state tracking system using JSON file storage
 * Provides methods for creating, updating, and querying environment state
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  EnvironmentState,
  EnvironmentConfig,
  TerraformResource,
  ResourceCost,
} from '../types';

export interface EnvironmentDatabase {
  environments: Record<string, EnvironmentState>;
  lastUpdated: string;
  version: string;
}

export class EnvironmentStateTracker {
  private dbPath: string;
  private db: EnvironmentDatabase;

  constructor(dbPath: string = '.ephemeral-demo/environments.json') {
    this.dbPath = dbPath;
    this.db = {
      environments: {},
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Initialize the state tracker by loading existing data or creating new database
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });

      // Try to load existing database
      await this.loadDatabase();
    } catch (error) {
      // If file doesn't exist or is corrupted, start with empty database
      await this.saveDatabase();
    }
  }

  /**
   * Create a new environment state entry
   */
  async createEnvironment(
    config: EnvironmentConfig
  ): Promise<EnvironmentState> {
    const environment: EnvironmentState = {
      id: this.generateEnvironmentId(config.name, config.branch),
      name: config.name,
      status: 'creating',
      branch: config.branch,
      createdAt: new Date(),
      urls: {},
      costs: {
        current: 0,
        projected: 0,
        breakdown: [],
      },
      resources: [],
    };

    // Set destroy time if auto-destroy is enabled
    if (config.autoDestroy && config.maxLifetime > 0) {
      environment.destroyAt = new Date(
        Date.now() + config.maxLifetime * 60 * 60 * 1000
      );
    }

    this.db.environments[environment.id] = environment;
    await this.saveDatabase();

    return environment;
  }

  /**
   * Update an existing environment state
   */
  async updateEnvironment(
    environmentId: string,
    updates: Partial<EnvironmentState>
  ): Promise<EnvironmentState> {
    // Load latest database state
    await this.loadDatabase();
    
    const environment = this.db.environments[environmentId];
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    // Merge updates with existing state
    Object.assign(environment, updates);
    await this.saveDatabase();

    return environment;
  }

  /**
   * Get environment state by ID
   */
  async getEnvironment(
    environmentId: string
  ): Promise<EnvironmentState | null> {
    await this.loadDatabase();
    return this.db.environments[environmentId] || null;
  }

  /**
   * Get environment state by branch name
   */
  async getEnvironmentByBranch(
    branch: string
  ): Promise<EnvironmentState | null> {
    await this.loadDatabase();
    const environments = Object.values(this.db.environments);
    return (
      environments.find(
        (env) => env.branch === branch && env.status !== 'destroyed'
      ) || null
    );
  }

  /**
   * List all environments with optional filtering
   */
  async listEnvironments(filter?: {
    status?: EnvironmentState['status'];
    branch?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  }): Promise<EnvironmentState[]> {
    await this.loadDatabase();
    let environments = Object.values(this.db.environments);

    if (filter) {
      if (filter.status) {
        environments = environments.filter(
          (env) => env.status === filter.status
        );
      }
      if (filter.branch) {
        environments = environments.filter(
          (env) => env.branch === filter.branch
        );
      }
      if (filter.createdAfter) {
        environments = environments.filter(
          (env) => env.createdAt >= filter.createdAfter!
        );
      }
      if (filter.createdBefore) {
        environments = environments.filter(
          (env) => env.createdAt <= filter.createdBefore!
        );
      }
    }

    return environments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get environments that are expired and ready for cleanup
   */
  async getExpiredEnvironments(): Promise<EnvironmentState[]> {
    await this.loadDatabase();
    const now = new Date();

    return Object.values(this.db.environments).filter(
      (env) =>
        env.destroyAt &&
        env.destroyAt <= now &&
        env.status !== 'destroyed' &&
        env.status !== 'destroying'
    );
  }

  /**
   * Update environment resources from Terraform state
   */
  async updateEnvironmentResources(
    environmentId: string,
    resources: TerraformResource[]
  ): Promise<void> {
    const environment = this.db.environments[environmentId];
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    environment.resources = resources;
    await this.saveDatabase();
  }

  /**
   * Update environment costs
   */
  async updateEnvironmentCosts(
    environmentId: string,
    costs: {
      current: number;
      projected: number;
      breakdown: ResourceCost[];
    }
  ): Promise<void> {
    const environment = this.db.environments[environmentId];
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    environment.costs = costs;
    await this.saveDatabase();
  }

  /**
   * Update environment URLs
   */
  async updateEnvironmentUrls(
    environmentId: string,
    urls: {
      application?: string;
      monitoring?: string;
    }
  ): Promise<void> {
    const environment = this.db.environments[environmentId];
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    environment.urls = { ...environment.urls, ...urls };
    await this.saveDatabase();
  }

  /**
   * Delete an environment from the database
   */
  async deleteEnvironment(environmentId: string): Promise<void> {
    if (!this.db.environments[environmentId]) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    delete this.db.environments[environmentId];
    await this.saveDatabase();
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalEnvironments: number;
    activeEnvironments: number;
    totalCost: number;
    oldestEnvironment?: Date;
    newestEnvironment?: Date;
  }> {
    await this.loadDatabase();
    const environments = Object.values(this.db.environments);

    const activeEnvironments = environments.filter(
      (env) => env.status === 'creating' || env.status === 'ready'
    );

    const totalCost = environments.reduce(
      (sum, env) => sum + env.costs.current,
      0
    );

    const dates = environments
      .map((env) => env.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());

    const result: {
      totalEnvironments: number;
      activeEnvironments: number;
      totalCost: number;
      oldestEnvironment?: Date;
      newestEnvironment?: Date;
    } = {
      totalEnvironments: environments.length,
      activeEnvironments: activeEnvironments.length,
      totalCost,
    };

    if (dates.length > 0) {
      const oldest = dates[0];
      const newest = dates[dates.length - 1];
      if (oldest) result.oldestEnvironment = oldest;
      if (newest) result.newestEnvironment = newest;
    }

    return result;
  }

  /**
   * Load database from file
   */
  private async loadDatabase(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Convert date strings back to Date objects
      Object.values(parsed.environments).forEach((env: any) => {
        env.createdAt = new Date(env.createdAt);
        if (env.destroyAt) {
          env.destroyAt = new Date(env.destroyAt);
        }
      });

      this.db = parsed;
    } catch (error) {
      // If file doesn't exist or is corrupted, keep current database
      if ((error as { code?: string }).code !== 'ENOENT') {
        console.warn(`Warning: Could not load environment database: ${error}`);
      }
    }
  }

  /**
   * Save database to file
   */
  private async saveDatabase(): Promise<void> {
    this.db.lastUpdated = new Date().toISOString();

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    // Write database with pretty formatting for readability
    await fs.writeFile(this.dbPath, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  /**
   * Generate a unique environment ID based on name and branch
   */
  private generateEnvironmentId(name: string, branch: string): string {
    // If the name already contains the branch and timestamp, just use it as the ID
    if (name.includes(branch) && name.match(/-[a-z0-9]+$/)) {
      return name;
    }
    
    // Otherwise, sanitize name and branch for use in AWS resource names
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const sanitizedBranch = branch.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const timestamp = Date.now().toString(36);

    return `${sanitizedName}-${sanitizedBranch}-${timestamp}`;
  }
}
