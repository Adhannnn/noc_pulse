// backend/src/groups/groups.service.ts
import { ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService implements OnModuleInit {
  private readonly logger = new Logger(GroupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Seed default group if database has no groups yet
    const count = await this.prisma.serviceGroup.count();
    if (count === 0) {
      await this.prisma.serviceGroup.create({
        data: { name: 'Home DC' },
      }).catch(() => {});
    }
  }

  async findAll() {
    return this.prisma.serviceGroup.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(name: string) {
    const existing = await this.prisma.serviceGroup.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException(`Group '${name}' already exists`);
    }

    return this.prisma.serviceGroup.create({
      data: { name },
    });
  }

  async rename(oldName: string, newName: string) {
    // 1. Rename the group record if it exists
    await this.prisma.serviceGroup.updateMany({
      where: { name: oldName },
      data: { name: newName },
    });

    // 2. Update all monitors assigned to this group
    await this.prisma.monitor.updateMany({
      where: { group: oldName },
      data: { group: newName },
    });

    return { success: true, oldName, newName };
  }

  async deleteGroup(name: string) {
    // 1. Delete assigned monitors
    await this.prisma.monitor.deleteMany({
      where: { group: name },
    });

    // 2. Delete group record
    await this.prisma.serviceGroup.deleteMany({
      where: { name },
    });

    return { success: true, name };
  }
}
