import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentsService,
  PaymentResult,
  PaymentStatus,
  PaymentMethod,
} from './payments.interface';

@Injectable()
export class PixService implements PaymentsService {
  private readonly logger = new Logger(PixService.name);

  async send(data: {
    amount: number;
    method: PaymentMethod;
    destination: string;
    description: string;
  }): Promise<PaymentResult> {
    this.logger.log(
      `send called: ${data.method} R$${data.amount} to ${data.destination}`,
    );
    // TODO: implement PIX/TED provider integration
    return {
      txId: `pix-${Date.now()}`,
      status: 'completed',
      processedAt: new Date().toISOString(),
    };
  }

  async getStatus(txId: string): Promise<PaymentStatus> {
    this.logger.log(`getStatus called for: ${txId}`);
    // TODO: implement PIX/TED provider integration
    return 'completed';
  }
}
