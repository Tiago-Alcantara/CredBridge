import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AuditService, AuditLogInput } from './audit.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;

  const prismaMock = {
    auditLog: { create: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  describe('log', () => {
    const base: AuditLogInput = {
      event: 'receivable.validated',
      entityId: 'r1',
      entityType: 'receivable',
      userId: 'op1',
    };

    it('persists the metadata object when provided', async () => {
      prismaMock.auditLog.create.mockResolvedValue({});

      await service.log({ ...base, metadata: { approved: true } });

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { approved: true } }),
        }),
      );
    });

    it('stores DbNull when no metadata is provided', async () => {
      prismaMock.auditLog.create.mockResolvedValue({});

      await service.log(base);

      const dataArg = prismaMock.auditLog.create.mock.calls[0][0].data;
      expect(dataArg.metadata).toBe(Prisma.DbNull);
    });
  });

  describe('findByEntity', () => {
    it('queries audit logs by entity ordered by recency', async () => {
      prismaMock.auditLog.findMany.mockResolvedValue([{ id: 'a1' }]);

      const result = await service.findByEntity('r1');

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityId: 'r1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([{ id: 'a1' }]);
    });
  });

  describe('findByUser', () => {
    it('applies the default limit of 20', async () => {
      prismaMock.auditLog.findMany.mockResolvedValue([]);

      await service.findByUser('u1');

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' }, take: 20 }),
      );
    });

    it('honours a custom limit', async () => {
      prismaMock.auditLog.findMany.mockResolvedValue([]);

      await service.findByUser('u1', 5);

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
