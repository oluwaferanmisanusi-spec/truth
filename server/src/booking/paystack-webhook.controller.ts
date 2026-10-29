// Paystack calls this after payments and refunds, even if the customer closed the page.
// It can't reach localhost, so it starts working once the API is deployed and the URL is
// set in Paystack (Settings → API Keys & Webhooks). Signed with our secret key.
import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBody,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { PaystackService } from '../paystack/paystack.service.js';
import { PaymentsService } from './payments.service.js';

type Event = {
  event: string;
  data: {
    reference?: string;
    transaction_reference?: string;
    transaction?: { reference?: string };
  };
};

@Public()
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);

  constructor(
    private readonly paystack: PaystackService,
    private readonly payments: PaymentsService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(
    @RawBody() raw: Buffer | undefined,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    // The signature covers the exact bytes Paystack sent, so check those, not the parsed body.
    if (!raw || !this.paystack.isValidWebhookSignature(raw, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }

    const { event, data } = JSON.parse(raw.toString('utf8')) as Event;
    try {
      if (event === 'charge.success' && data.reference) {
        // Re-check with Paystack rather than trusting the event body.
        await this.payments.settle(data.reference);
      } else if (event === 'refund.processed' || event === 'refund.failed') {
        const reference =
          data.transaction_reference ?? data.transaction?.reference;
        if (reference)
          await this.payments.markRefund(
            reference,
            event === 'refund.processed' ? 'processed' : 'failed',
          );
      }
    } catch (error) {
      // Payments that aren't bookings (e.g. dashboard test charges) end up here too.
      this.logger.error(`Paystack webhook not handled: ${event}`, error);
    }
    return { ok: true };
  }
}
