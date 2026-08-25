// backend/src/groups/groups.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('api/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @Post()
  create(@Body('name') name: string) {
    return this.groupsService.create(name);
  }

  @Post('rename')
  rename(@Body('oldName') oldName: string, @Body('newName') newName: string) {
    return this.groupsService.rename(oldName, newName);
  }

  @Delete(':name')
  deleteGroup(@Param('name') name: string) {
    return this.groupsService.deleteGroup(name);
  }
}
