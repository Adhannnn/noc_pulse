import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: {
            hostMetric: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: EventsGateway,
          useValue: {
            broadcastMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
