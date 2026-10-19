import { Test, TestingModule } from '@nestjs/testing';
import { MonitorsService } from './monitors.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProberService } from '../prober/prober.service';
import { EventsGateway } from '../events/events.gateway';
import { AlertsService } from '../alerts/alerts.service';

describe('MonitorsService', () => {
  let service: MonitorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorsService,
        {
          provide: PrismaService,
          useValue: {
            monitor: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: ProberService,
          useValue: {
            probe: jest.fn(),
          },
        },
        {
          provide: EventsGateway,
          useValue: {
            broadcastMonitorUpdate: jest.fn(),
          },
        },
        {
          provide: AlertsService,
          useValue: {
            dispatchAlert: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MonitorsService>(MonitorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
