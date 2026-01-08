/**
 * Git webhook handler for processing Git repository events
 * Implements Express.js webhook endpoint with signature verification
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { GitWebhookEvent } from '../types';

export interface WebhookConfig {
  /** Port for the webhook server */
  port: number;
  /** Secret for webhook signature verification */
  secret: string;
  /** Path for the webhook endpoint */
  path: string;
}

export interface WebhookPayload {
  /** GitHub/GitLab event type */
  action?: string;
  /** Pull request data */
  pull_request?: {
    state: string;
    merged: boolean;
    head: {
      ref: string;
    };
  };
  /** Repository data */
  repository: {
    name: string;
    owner: {
      login: string;
    };
    html_url: string;
  };
  /** Branch reference for push events */
  ref?: string;
  /** Indicates if branch was deleted */
  deleted?: boolean;
}

/**
 * Git webhook handler class that manages Express.js server for receiving Git events
 */
export class GitWebhookHandler {
  private app: express.Application;
  private server?: any;
  private config: WebhookConfig;
  private eventHandlers: Map<string, (event: GitWebhookEvent) => Promise<void>>;

  constructor(config: WebhookConfig) {
    this.config = config;
    this.app = express();
    this.eventHandlers = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Set up Express middleware for JSON parsing and security
   */
  private setupMiddleware(): void {
    // Parse JSON payloads
    this.app.use(express.json({ limit: '10mb' }));
    
    // Add basic security headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Set up webhook routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Main webhook endpoint
    this.app.post(this.config.path, async (req: Request, res: Response): Promise<void> => {
      try {
        // Verify webhook signature
        if (!this.verifySignature(req)) {
          console.error('Webhook signature verification failed');
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        // Process the webhook payload
        const event = this.parseWebhookPayload(req);
        if (event) {
          await this.processEvent(event);
          res.json({ status: 'processed', eventType: event.eventType });
        } else {
          res.json({ status: 'ignored', reason: 'unsupported event type' });
        }
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Catch-all for unsupported routes
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  private verifySignature(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return false;
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', this.config.secret)
      .update(payload, 'utf8')
      .digest('hex');

    const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignatureWithPrefix)
    );
  }

  /**
   * Parse webhook payload into standardized GitWebhookEvent
   */
  private parseWebhookPayload(req: Request): GitWebhookEvent | null {
    const payload: WebhookPayload = req.body;
    const eventType = req.headers['x-github-event'] as string;

    // Handle pull request events
    if (eventType === 'pull_request' && payload.pull_request) {
      const action = payload.action as 'opened' | 'closed' | 'merged';
      const branch = payload.pull_request.head.ref;
      
      // Determine if PR was merged
      const finalAction = payload.pull_request.merged ? 'merged' : action;

      return {
        eventType: 'pull_request',
        branch,
        action: finalAction,
        repository: {
          name: payload.repository.name,
          owner: payload.repository.owner.login,
          url: payload.repository.html_url,
        },
        timestamp: new Date(),
      };
    }

    // Handle push events (including branch deletion)
    if (eventType === 'push') {
      if (payload.deleted) {
        // Branch deletion event
        const branch = payload.ref?.replace('refs/heads/', '') || '';
        return {
          eventType: 'branch_delete',
          branch,
          repository: {
            name: payload.repository.name,
            owner: payload.repository.owner.login,
            url: payload.repository.html_url,
          },
          timestamp: new Date(),
        };
      } else {
        // Regular push event
        const branch = payload.ref?.replace('refs/heads/', '') || '';
        return {
          eventType: 'push',
          branch,
          repository: {
            name: payload.repository.name,
            owner: payload.repository.owner.login,
            url: payload.repository.html_url,
          },
          timestamp: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Process a parsed Git event by calling registered handlers
   */
  private async processEvent(event: GitWebhookEvent): Promise<void> {
    console.log(`Processing Git event: ${event.eventType} for branch ${event.branch}`);
    
    // Call all registered handlers for this event type
    const handler = this.eventHandlers.get(event.eventType);
    if (handler) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.eventType}:`, error);
        throw error;
      }
    } else {
      console.log(`No handler registered for event type: ${event.eventType}`);
    }
  }

  /**
   * Register an event handler for a specific Git event type
   */
  public onEvent(eventType: string, handler: (event: GitWebhookEvent) => Promise<void>): void {
    this.eventHandlers.set(eventType, handler);
  }

  /**
   * Start the webhook server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`Git webhook handler listening on port ${this.config.port}`);
          console.log(`Webhook endpoint: http://localhost:${this.config.port}${this.config.path}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the webhook server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Git webhook handler stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the current server configuration
   */
  public getConfig(): WebhookConfig {
    return { ...this.config };
  }
}