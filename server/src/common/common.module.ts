import { Global, Module } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { PaystackService } from '../paystack/paystack.service.js';
import { ShopInfoService } from './shop-info.service.js';
import { SiteService } from './site.service.js';

// What every feature may need: email, payments, links to the website and the shop's rules.
@Global()
@Module({
  providers: [EmailService, PaystackService, SiteService, ShopInfoService],
  exports: [EmailService, PaystackService, SiteService, ShopInfoService],
})
export class CommonModule {}
