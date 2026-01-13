export interface EnvironmentData {
  environmentId: string;
  branch: string;
  region: string;
  instanceType: string;
  deployedAt: string;
  version: string;
  buildNumber: string;
  gitCommit: string;
  serverTime: string;
  uptime: number;
  nodeVersion: string;
  platform: string;
  arch: string;
}

export interface MetricsData {
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  loadAverage: number[];
  freeMemory: number;
  totalMemory: number;
  platform: {
    type: string;
    release: string;
    arch: string;
    hostname: string;
  };
}

export interface LoadTestRequest {
  duration: number;
  intensity: 'light' | 'medium' | 'heavy';
}

export interface LoadTestResponse {
  message: string;
  duration: number;
  intensity: string;
  startTime: string;
  estimatedEndTime: string;
}