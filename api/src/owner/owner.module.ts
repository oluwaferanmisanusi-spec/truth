import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module.js';
import { OwnerBarbersService } from './owner-barbers.service.js';
import { OwnerBookingsService } from './owner-bookings.service.js';
import { OwnerManagersService } from './owner-managers.service.js';
import {
  ManagerInvitesController,
  OwnerBarbersController,
  OwnerBookingsController,
  OwnerManagersController,
  OwnerServicesController,
  OwnerSettingsController,
  TwoStepController,
} from './owner.controllers.js';
import { OwnerServicesService } from './owner-services.service.js';
import { OwnerSettingsService } from './owner-settings.service.js';
import { TwoStepService } from './two-step.service.js';

@Module({
  // BookingModule shares PaymentsService, for the refund when the owner cancels.
  imports: [BookingModule],
  controllers: [
    OwnerBookingsController,
    OwnerServicesController,
    OwnerBarbersController,
    OwnerSettingsController,
    OwnerManagersController,
    ManagerInvitesController,
    TwoStepController,
  ],
  providers: [
    OwnerBookingsService,
    OwnerServicesService,
    OwnerBarbersService,
    OwnerSettingsService,
    OwnerManagersService,
    TwoStepService,
  ],
})
export class OwnerModule {}
