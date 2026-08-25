// backend/src/prober/prober.module.ts
import { Module } from '@nestjs/common';
import { ProberService } from './prober.service';

@Module({
  providers: [ProberService],
  exports: [ProberService],
})
export class ProberModule {}