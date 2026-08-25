// backend/src/datacenters/datacenters.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DataCentersService } from './datacenters.service';

@Controller('api/datacenters')
export class DataCentersController {
  constructor(private readonly dataCentersService: DataCentersService) {}

  @Get()
  findAll() {
    return this.dataCentersService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; location?: string; description?: string }) {
    return this.dataCentersService.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dataCentersService.remove(id);
  }
}
