import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module.js';
import { AvailabilityService } from './availability.service.js';
import { BookingController } from './booking.controller.js';
import { HoldsService } from './holds.service.js';
import {
  GuestBookingController,
  MyBookingsController,
} from './manage.controllers.js';
import { ManageService } from './manage.service.js';
import { PaymentsService } from './payments.service.js';
import { PaystackWebhookController } from './paystack-webhook.controller.js';

@Module({
  imports: [ShopModule],
  controllers: [
    BookingController,
    PaystackWebhookController,
    MyBookingsController,
    GuestBookingController,
  ],
  providers: [
    AvailabilityService,
    HoldsService,
    PaymentsService,
    ManageService,
  ],
  // The owner's cancel (Stage D) reuses refunds and booking emails.
  exports: [PaymentsService],
})
export class BookingModule {}
