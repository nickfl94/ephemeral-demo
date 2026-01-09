import { EnvironmentData, MetricsData, LoadTestRequest, LoadTestResponse } from '../types';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';

export const fetchEnvironmentData = async (): Promise<EnvironmentData> => {
  const response = await fetch(`${API_BASE}/api/environment`);
  if (!response.ok) {
    throw new Error('Failed to fetch environment data');
  }
  return response.json();
};

export const fetchMetricsData = async (): Promise<MetricsData> => {
  const response = await fetch(`${API_BASE}/api/metrics`);
  if (!response.ok) {
    throw new Error('Failed to fetch metrics data');
  }
  return response.json();
};

export const startLoadTest = async (request: LoadTestRequest): Promise<LoadTestResponse> => {
  const response = await fetch(`${API_BASE}/api/load-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error('Failed to start load test');
  }
  
  return response.json();
};

export const checkHealth = async (): Promise<any> => {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json();
};