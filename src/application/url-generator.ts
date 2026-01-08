/**
 * URL generation functionality for deployed applications
 */

import { EnvironmentState } from '../types';
import { DeploymentTarget } from './types';

/**
 * URL generator class for creating application access URLs
 */
export class URLGenerator {
  /**
   * Generate application URLs based on deployment target and environment
   */
  generateUrls(
    target: DeploymentTarget,
    environment: EnvironmentState,
    applicationPort: number = 80
  ): { application: string; healthCheck: string; monitoring?: string } {
    switch (target.type) {
      case 'ec2':
        return this.generateEC2Urls(target, environment, applicationPort);
      case 'ecs':
        return this.generateECSUrls(target, environment, applicationPort);
      default:
        throw new Error(`Unsupported deployment target type: ${target.type}`);
    }
  }

  /**
   * Generate URLs for EC2 deployment
   */
  private generateEC2Urls(
    target: DeploymentTarget,
    environment: EnvironmentState,
    applicationPort: number
  ): { application: string; healthCheck: string; monitoring?: string } {
    // For EC2, we'll use the public IP or DNS name
    // In a real implementation, this would query AWS to get the actual instance details
    const instanceId = (target.config as any).instanceId;
    const region = target.region;
    
    // Generate URLs based on environment name and region
    const baseUrl = this.generateBaseUrl(environment.name, region, applicationPort);
    
    return {
      application: baseUrl,
      healthCheck: `${baseUrl}/health`,
      monitoring: `https://${region}.console.aws.amazon.com/ec2/v2/home?region=${region}#InstanceDetails:instanceId=${instanceId}`
    };
  }

  /**
   * Generate URLs for ECS deployment
   */
  private generateECSUrls(
    target: DeploymentTarget,
    environment: EnvironmentState,
    applicationPort: number
  ): { application: string; healthCheck: string; monitoring?: string } {
    const ecsConfig = target.config as any;
    const region = target.region;
    
    // Generate URLs based on environment name and region
    const baseUrl = this.generateBaseUrl(environment.name, region, applicationPort);
    
    return {
      application: baseUrl,
      healthCheck: `${baseUrl}/health`,
      monitoring: `https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${ecsConfig.clusterName}/services/${ecsConfig.serviceName}/details`
    };
  }

  /**
   * Generate base URL for the application
   */
  private generateBaseUrl(environmentName: string, region: string, port: number): string {
    // Sanitize environment name for URL
    const sanitizedName = environmentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Generate a predictable subdomain based on environment name
    const subdomain = `${sanitizedName}-demo`;
    
    // In a real implementation, this would be a proper domain or load balancer URL
    // For demo purposes, we'll generate a placeholder URL
    if (port === 80 || port === 443) {
      return `https://${subdomain}.ephemeral-demo.example.com`;
    } else {
      return `https://${subdomain}.ephemeral-demo.example.com:${port}`;
    }
  }

  /**
   * Generate monitoring dashboard URL
   */
  generateMonitoringUrl(
    environment: EnvironmentState,
    region: string
  ): string {
    const dashboardName = `ephemeral-${environment.name}`;
    return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=${dashboardName}`;
  }

  /**
   * Generate cost monitoring URL
   */
  generateCostUrl(
    environment: EnvironmentState,
    region: string
  ): string {
    // Generate URL to AWS Cost Explorer filtered by environment tags
    const tagFilter = encodeURIComponent(`Environment=${environment.name}`);
    return `https://console.aws.amazon.com/cost-management/home?region=${region}#/cost-explorer?chartStyle=Stack&costAggregate=unBlendedCost&endDate=2024-01-31&filter=%5B%7B%22dimension%22%3A%22TagKey%22%2C%22values%22%3A%5B%22${tagFilter}%22%5D%7D%5D&granularity=Daily&groupBy=%5B%22Service%22%5D&isTemplate=true&reportName=&startDate=2024-01-01&usageAggregate=undefined`;
  }

  /**
   * Validate URL accessibility
   */
  async validateUrl(url: string, timeout: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;

    } catch {
      return false;
    }
  }
}