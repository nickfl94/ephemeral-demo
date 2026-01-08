/**
 * Health check functionality for deployed applications
 */

import { HealthCheckResult } from './types';

/**
 * Health checker class for verifying application availability
 */
export class HealthChecker {
  /**
   * Perform health check on deployed application
   */
  async checkHealth(
    url: string,
    expectedStatus: number = 200,
    timeout: number = 10000,
    retries: number = 3,
    interval: number = 5000
  ): Promise<HealthCheckResult> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.performSingleCheck(url, expectedStatus, timeout);
        
        if (result.healthy) {
          return result;
        }

        lastError = result.error;
        
        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await this.sleep(interval);
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await this.sleep(interval);
        }
      }
    }

    return {
      healthy: false,
      statusCode: 0,
      responseTime: 0,
      error: `Health check failed after ${retries} attempts. Last error: ${lastError}`
    };
  }

  /**
   * Perform a single health check attempt
   */
  private async performSingleCheck(
    url: string,
    expectedStatus: number,
    timeout: number
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Use fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ephemeral-demo-health-checker/1.0'
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Get response body (truncated for logging)
      let responseBody: string | undefined;
      try {
        const text = await response.text();
        responseBody = text.length > 500 ? text.substring(0, 500) + '...' : text;
      } catch {
        responseBody = 'Unable to read response body';
      }

      const healthy = response.status === expectedStatus;

      return {
        healthy,
        statusCode: response.status,
        responseTime,
        responseBody,
        ...(healthy ? {} : { error: `Expected status ${expectedStatus}, got ${response.status}` })
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          healthy: false,
          statusCode: 0,
          responseTime,
          error: `Request timeout after ${timeout}ms`
        };
      }

      return {
        healthy: false,
        statusCode: 0,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown network error'
      };
    }
  }

  /**
   * Wait for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Perform comprehensive health check with multiple endpoints
   */
  async checkMultipleEndpoints(
    baseUrl: string,
    endpoints: Array<{ path: string; expectedStatus?: number }>,
    timeout: number = 10000
  ): Promise<{ healthy: boolean; results: Array<HealthCheckResult & { endpoint: string }> }> {
    const results = await Promise.all(
      endpoints.map(async (endpoint) => {
        const url = `${baseUrl}${endpoint.path}`;
        const result = await this.performSingleCheck(
          url,
          endpoint.expectedStatus || 200,
          timeout
        );
        return {
          ...result,
          endpoint: endpoint.path
        };
      })
    );

    const healthy = results.every(result => result.healthy);

    return {
      healthy,
      results
    };
  }
}