import axios from 'axios';
import { logger } from '../utils/logger';

interface WebhookPayload {
  event: string;
  tenantId: string;
  data: unknown;
  timestamp: string;
}

export class WebhookService {
  async send(url: string, payload: WebhookPayload): Promise<boolean> {
    try {
      await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10_000,
      });
      logger.info(`Webhook sent: ${payload.event} -> ${url}`);
      return true;
    } catch (err) {
      logger.error(`Webhook failed: ${payload.event} -> ${url}`, err);
      return false;
    }
  }
}
