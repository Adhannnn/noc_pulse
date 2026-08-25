import { Test, TestingModule } from '@nestjs/testing';
import { ProberService } from './prober.service';

describe('ProberService', () => {
  let service: ProberService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProberService],
    }).compile();

    service = module.get<ProberService>(ProberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
