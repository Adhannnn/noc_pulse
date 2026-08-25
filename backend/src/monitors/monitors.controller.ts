// backend/src/monitors/monitors.controller.ts
import { Body, Controller, Delete, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';

@Controller('api/monitors')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Post()
  create(@Body() dto: CreateMonitorDto) {
    return this.monitorsService.create(dto);
  }

  @Get()
  findAll() {
    return this.monitorsService.findAll();
  }

  @Get('incidents/all')
  findAllIncidents() {
    return this.monitorsService.findAllIncidents();
  }

  @Post('groups/rename')
  renameGroup(@Body('oldName') oldName: string, @Body('newName') newName: string) {
    return this.monitorsService.renameGroup(oldName, newName);
  }

  @Post('groups/delete')
  deleteGroup(@Body('groupName') groupName: string) {
    return this.monitorsService.deleteGroup(groupName);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.monitorsService.findOne(id);
  }

  @Post(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateMonitorDto>) {
    return this.monitorsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.monitorsService.remove(id);
  }
}