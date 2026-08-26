// backend/src/ssh/ssh.module.ts
import { Module } from '@nestjs/common';
import { SshGateway } from './ssh.gateway';
import { SshService } from './ssh.service';

@Module({
  providers: [SshGateway, SshService],
  exports: [SshService],
})
export class SshModule {}
