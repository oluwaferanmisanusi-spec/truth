import { Module } from '@nestjs/common';
import { BarberBlocksService } from './barber-blocks.service.js';
import { BarberInvitesService } from './barber-invites.service.js';
import { BarberScheduleService } from './barber-schedule.service.js';
import {
  BarberController,
  BarberInvitesController,
} from './barber.controllers.js';

@Module({
  controllers: [BarberInvitesController, BarberController],
  providers: [BarberInvitesService, BarberScheduleService, BarberBlocksService],
})
export class BarberModule {}
