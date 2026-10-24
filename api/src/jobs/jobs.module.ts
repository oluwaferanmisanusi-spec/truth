import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
  // BookingModule shares PaymentsService, for checking payments and retrying refunds.
  imports: [BookingModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
