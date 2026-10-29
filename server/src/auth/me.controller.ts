import { Controller, Get } from '@nestjs/common';
import type { Me } from '../contracts/me.js';
import { CurrentUser } from './decorators.js';

@Controller('me')
export class MeController {
  /** Who is logged in. Not @Public, so the guard has already rejected anyone who isn't. */
  @Get()
  me(@CurrentUser() user: Me): Me {
    return user;
  }
}
