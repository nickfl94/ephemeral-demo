/**
 * Version management for application deployments
 */

import { ApplicationConfig } from './types';

/**
 * Version information interface
 */
export interface VersionInfo {
  /** Version string (e.g., "1.0.0", "latest", "main-abc123") */
  version: string;
  /** Git commit hash (if available) */
  commit?: string;
  /** Git branch name */
  branch?: string;
  /** Build timestamp */
  buildTime: Date;
  /** Version tags */
  tags: string[];
  /** Version metadata */
  metadata: Record<string, string>;
}

/**
 * Version manager class for handling application versions
 */
export class VersionManager {
  private readonly versions: Map<string, VersionInfo[]> = new Map();

  /**
   * Register a new version for an application
   */
  registerVersion(appName: string, versionInfo: VersionInfo): void {
    if (!this.versions.has(appName)) {
      this.versions.set(appName, []);
    }

    const appVersions = this.versions.get(appName)!;
    
    // Remove existing version with same version string
    const existingIndex = appVersions.findIndex(v => v.version === versionInfo.version);
    if (existingIndex >= 0) {
      appVersions.splice(existingIndex, 1);
    }

    // Add new version
    appVersions.push(versionInfo);
    
    // Sort by build time (newest first)
    appVersions.sort((a, b) => b.buildTime.getTime() - a.buildTime.getTime());
  }

  /**
   * Get all versions for an application
   */
  getVersions(appName: string): VersionInfo[] {
    return this.versions.get(appName) || [];
  }

  /**
   * Get specific version information
   */
  getVersion(appName: string, version: string): VersionInfo | undefined {
    const appVersions = this.versions.get(appName) || [];
    return appVersions.find(v => v.version === version);
  }

  /**
   * Get latest version for an application
   */
  getLatestVersion(appName: string): VersionInfo | undefined {
    const appVersions = this.versions.get(appName) || [];
    return appVersions[0]; // Already sorted by build time
  }

  /**
   * Generate version string from Git information
   */
  static generateVersionFromGit(branch: string, commit?: string): string {
    if (!commit) {
      return branch === 'main' || branch === 'master' ? 'latest' : branch;
    }

    const shortCommit = commit.substring(0, 7);
    
    if (branch === 'main' || branch === 'master') {
      return `latest-${shortCommit}`;
    }

    return `${branch}-${shortCommit}`;
  }

  /**
   * Create version-specific application configuration
   */
  createVersionedConfig(
    baseConfig: ApplicationConfig,
    versionInfo: VersionInfo
  ): ApplicationConfig {
    return {
      ...baseConfig,
      version: versionInfo.version,
      docker: {
        ...baseConfig.docker,
        env: {
          ...baseConfig.docker.env,
          APP_VERSION: versionInfo.version,
          GIT_COMMIT: versionInfo.commit || 'unknown',
          GIT_BRANCH: versionInfo.branch || 'unknown',
          BUILD_TIME: versionInfo.buildTime.toISOString(),
          ...versionInfo.metadata
        }
      }
    };
  }

  /**
   * Compare two versions
   */
  static compareVersions(a: string, b: string): number {
    // Handle special cases
    if (a === b) return 0;
    if (a === 'latest') return 1;
    if (b === 'latest') return -1;

    // Try semantic version comparison
    const semverA = this.parseSemver(a);
    const semverB = this.parseSemver(b);

    if (semverA && semverB) {
      return this.compareSemver(semverA, semverB);
    }

    // Fall back to string comparison
    return a.localeCompare(b);
  }

  /**
   * Parse semantic version string
   */
  private static parseSemver(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match || !match[1] || !match[2] || !match[3]) return null;

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }

  /**
   * Compare semantic versions
   */
  private static compareSemver(
    a: { major: number; minor: number; patch: number },
    b: { major: number; minor: number; patch: number }
  ): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }

  /**
   * Get version history for an application
   */
  getVersionHistory(appName: string, limit: number = 10): VersionInfo[] {
    const versions = this.getVersions(appName);
    return versions.slice(0, limit);
  }

  /**
   * Clean up old versions (keep only specified number)
   */
  cleanupOldVersions(appName: string, keepCount: number = 5): VersionInfo[] {
    const versions = this.versions.get(appName) || [];
    
    if (versions.length <= keepCount) {
      return [];
    }

    const toRemove = versions.splice(keepCount);
    return toRemove;
  }

  /**
   * Get version statistics
   */
  getVersionStats(appName: string): {
    totalVersions: number;
    latestVersion: string;
    oldestVersion: string;
    branches: string[];
    tags: string[];
  } {
    const versions = this.getVersions(appName);
    
    if (versions.length === 0) {
      return {
        totalVersions: 0,
        latestVersion: 'none',
        oldestVersion: 'none',
        branches: [],
        tags: []
      };
    }

    const branches = [...new Set(versions.map(v => v.branch).filter((branch): branch is string => branch !== undefined))];
    const tags = [...new Set(versions.flatMap(v => v.tags))];

    return {
      totalVersions: versions.length,
      latestVersion: versions[0]?.version || 'unknown',
      oldestVersion: versions[versions.length - 1]?.version || 'unknown',
      branches,
      tags
    };
  }
}