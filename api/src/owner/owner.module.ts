import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module.js';
import { OwnerBarbersService } from './owner-barbers.service.js';
import { OwnerBookingsService } from './owner-bookings.service.js';
import {
  OwnerBarbersController,
  OwnerBookingsController,
  OwnerServicesController,
  OwnerSettingsController,
} from './owner.controllers.js';
import { OwnerServicesService } from './owner-services.service.js';
import { OwnerSettingsService } from './owner-settings.service.js';

@Module({
  // BookingModule shares PaymentsService, for the refund when the owner cancels.
  imports: [BookingModule],
  controllers: [
    OwnerBookingsController,
    OwnerServicesController,
    OwnerBarbersController,
    OwnerSettingsController,
  ],
  providers: [
    OwnerBookingsService,
    OwnerServicesService,
    OwnerBarbersService,
    OwnerSettingsService,
  ],
})
export class OwnerModule {}
