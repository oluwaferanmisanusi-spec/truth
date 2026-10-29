import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import type { ServiceSummary, ShopInfo } from '../contracts/shop.js';
import { ShopService } from './shop.service.js';

@Public()
@Controller()
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('shop')
  info(): Promise<ShopInfo> {
    return this.shop.info();
  }

  @Get('services')
  services(): Promise<ServiceSummary[]> {
    return this.shop.services();
  }
}
