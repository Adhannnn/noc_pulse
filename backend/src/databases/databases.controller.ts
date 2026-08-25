// backend/src/databases/databases.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { DatabasesService } from './databases.service';

@Controller('api/databases')
export class DatabasesController {
  constructor(private readonly databasesService: DatabasesService) {}

  @Get()
  findAll() {
    return this.databasesService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; engine: string; host: string; port: number; database: string; username: string; password?: string }) {
    return this.databasesService.create(body);
  }

  @Post('test')
  testConnection(@Body() body: { engine: string; host: string; port: number }) {
    return this.databasesService.testConnection(body);
  }

  @Get(':id/tables')
  getTables(@Param('id') id: string) {
    return this.databasesService.getTables(id);
  }

  @Get(':id/tables/:tableName')
  getTableData(@Param('id') id: string, @Param('tableName') tableName: string) {
    return this.databasesService.getTableData(id, tableName);
  }

  @Post(':id/query')
  executeQuery(@Param('id') id: string, @Body('query') query: string) {
    return this.databasesService.executeQuery(id, query);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.databasesService.remove(id);
  }
}
