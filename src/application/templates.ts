/**
 * Application templates for different types of deployments
 */

import { ApplicationConfig, PartialApplicationConfig } from './types';

/**
 * Template manager for creating application configurations
 */
export class ApplicationTemplates {
  /**
   * Get template configuration for web application
   */
  static getWebAppTemplate(
    name: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    const baseTemplate: ApplicationConfig = {
      name,
      type: 'webapp',
      version,
      docker: {
        baseImage: 'node:18-alpine',
        port: 3000,
        env: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        buildContext: './webapp',
        dockerfile: 'Dockerfile'
      },
      healthCheck: {
        path: '/health',
        expectedStatus: 200,
        timeout: 10,
        retries: 3,
        interval: 5
      }
    };

    return this.mergeConfigurations(baseTemplate, customizations);
  }

  /**
   * Get template configuration for API application
   */
  static getApiTemplate(
    name: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    const baseTemplate: ApplicationConfig = {
      name,
      type: 'api',
      version,
      docker: {
        baseImage: 'node:18-alpine',
        port: 8080,
        env: {
          NODE_ENV: 'production',
          PORT: '8080',
          API_VERSION: 'v1'
        },
        buildContext: './api',
        dockerfile: 'Dockerfile'
      },
      healthCheck: {
        path: '/api/v1/health',
        expectedStatus: 200,
        timeout: 10,
        retries: 3,
        interval: 5
      }
    };

    return this.mergeConfigurations(baseTemplate, customizations);
  }

  /**
   * Get template configuration for full-stack application
   */
  static getFullStackTemplate(
    name: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    const baseTemplate: ApplicationConfig = {
      name,
      type: 'fullstack',
      version,
      docker: {
        baseImage: 'node:18-alpine',
        port: 3000,
        env: {
          NODE_ENV: 'production',
          PORT: '3000',
          API_PORT: '8080',
          DATABASE_URL: 'sqlite:///app/data/app.db'
        },
        buildContext: './fullstack',
        dockerfile: 'Dockerfile'
      },
      healthCheck: {
        path: '/health',
        expectedStatus: 200,
        timeout: 15,
        retries: 5,
        interval: 10
      }
    };

    return this.mergeConfigurations(baseTemplate, customizations);
  }

  /**
   * Get template configuration for React web application
   */
  static getReactTemplate(
    name: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    const baseTemplate: ApplicationConfig = {
      name,
      type: 'webapp',
      version,
      docker: {
        baseImage: 'node:18-alpine',
        port: 3000,
        env: {
          NODE_ENV: 'production',
          PORT: '3000',
          REACT_APP_API_URL: '/api'
        },
        buildContext: './react-app',
        dockerfile: 'Dockerfile.react'
      },
      healthCheck: {
        path: '/',
        expectedStatus: 200,
        timeout: 10,
        retries: 3,
        interval: 5
      }
    };

    return this.mergeConfigurations(baseTemplate, customizations);
  }

  /**
   * Get template configuration for Express.js API
   */
  static getExpressApiTemplate(
    name: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    const baseTemplate: ApplicationConfig = {
      name,
      type: 'api',
      version,
      docker: {
        baseImage: 'node:18-alpine',
        port: 8080,
        env: {
          NODE_ENV: 'production',
          PORT: '8080',
          CORS_ORIGIN: '*',
          LOG_LEVEL: 'info'
        },
        buildContext: './express-api',
        dockerfile: 'Dockerfile.express'
      },
      healthCheck: {
        path: '/health',
        expectedStatus: 200,
        timeout: 10,
        retries: 3,
        interval: 5
      }
    };

    return this.mergeConfigurations(baseTemplate, customizations);
  }

  /**
   * Get template configuration for Python Flask API
   */
  static getPythonFlaskTemplate(
    name: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    const baseTemplate: ApplicationConfig = {
      name,
      type: 'api',
      version,
      docker: {
        baseImage: 'python:3.11-alpine',
        port: 5000,
        env: {
          FLASK_ENV: 'production',
          FLASK_APP: 'app.py',
          PORT: '5000'
        },
        buildContext: './flask-api',
        dockerfile: 'Dockerfile.flask'
      },
      healthCheck: {
        path: '/health',
        expectedStatus: 200,
        timeout: 10,
        retries: 3,
        interval: 5
      }
    };

    return this.mergeConfigurations(baseTemplate, customizations);
  }

  /**
   * Get template configuration for Next.js full-stack application
   */
  static getNextJsTemplate(
    name: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    const baseTemplate: ApplicationConfig = {
      name,
      type: 'fullstack',
      version,
      docker: {
        baseImage: 'node:18-alpine',
        port: 3000,
        env: {
          NODE_ENV: 'production',
          PORT: '3000',
          NEXTAUTH_URL: 'http://localhost:3000',
          NEXTAUTH_SECRET: 'demo-secret'
        },
        buildContext: './nextjs-app',
        dockerfile: 'Dockerfile.nextjs'
      },
      healthCheck: {
        path: '/api/health',
        expectedStatus: 200,
        timeout: 15,
        retries: 5,
        interval: 10
      }
    };

    return this.mergeConfigurations(baseTemplate, customizations);
  }

  /**
   * Get all available template types
   */
  static getAvailableTemplates(): Array<{
    name: string;
    type: 'webapp' | 'api' | 'fullstack';
    description: string;
    baseImage: string;
  }> {
    return [
      {
        name: 'webapp',
        type: 'webapp',
        description: 'Generic web application with Node.js',
        baseImage: 'node:18-alpine'
      },
      {
        name: 'api',
        type: 'api',
        description: 'Generic API service with Node.js',
        baseImage: 'node:18-alpine'
      },
      {
        name: 'fullstack',
        type: 'fullstack',
        description: 'Full-stack application with frontend and backend',
        baseImage: 'node:18-alpine'
      },
      {
        name: 'react',
        type: 'webapp',
        description: 'React web application with modern build tools',
        baseImage: 'node:18-alpine'
      },
      {
        name: 'express-api',
        type: 'api',
        description: 'Express.js REST API with middleware support',
        baseImage: 'node:18-alpine'
      },
      {
        name: 'flask-api',
        type: 'api',
        description: 'Python Flask API with SQLAlchemy support',
        baseImage: 'python:3.11-alpine'
      },
      {
        name: 'nextjs',
        type: 'fullstack',
        description: 'Next.js full-stack application with API routes',
        baseImage: 'node:18-alpine'
      }
    ];
  }

  /**
   * Create configuration from template name
   */
  static createFromTemplate(
    templateName: string,
    appName: string,
    version: string = 'latest',
    customizations: PartialApplicationConfig = {}
  ): ApplicationConfig {
    switch (templateName.toLowerCase()) {
      case 'webapp':
        return this.getWebAppTemplate(appName, version, customizations);
      case 'api':
        return this.getApiTemplate(appName, version, customizations);
      case 'fullstack':
        return this.getFullStackTemplate(appName, version, customizations);
      case 'react':
        return this.getReactTemplate(appName, version, customizations);
      case 'express-api':
        return this.getExpressApiTemplate(appName, version, customizations);
      case 'flask-api':
        return this.getPythonFlaskTemplate(appName, version, customizations);
      case 'nextjs':
        return this.getNextJsTemplate(appName, version, customizations);
      default:
        throw new Error(`Unknown template: ${templateName}. Available templates: ${this.getAvailableTemplates().map(t => t.name).join(', ')}`);
    }
  }

  /**
   * Merge base template with customizations
   */
  private static mergeConfigurations(
    base: ApplicationConfig,
    customizations: PartialApplicationConfig
  ): ApplicationConfig {
    return {
      ...base,
      ...customizations,
      docker: {
        ...base.docker,
        ...customizations.docker,
        env: {
          ...base.docker.env,
          ...customizations.docker?.env
        }
      },
      healthCheck: {
        ...base.healthCheck,
        ...customizations.healthCheck
      }
    };
  }
}