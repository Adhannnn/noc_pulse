// backend/src/ip-management/ip-management.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IpManagementService } from './ip-management.service';

@Controller('api/ip-management')
export class IpManagementController {
  constructor(private readonly ipService: IpManagementService) {}

  @Get()
  findAll() {
    return this.ipService.findAll();
  }

  @Post()
  create(@Body() body: { ip: string; subnet?: string; hostname?: string; status?: string; assignedTo?: string }) {
    return this.ipService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ipService.remove(id);
  }
}
