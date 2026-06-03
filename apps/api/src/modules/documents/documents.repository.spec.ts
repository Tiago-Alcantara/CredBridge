import { DocumentsRepository } from './documents.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('DocumentsRepository', () => {
  it('stores invoice document hash on the parent receivable', async () => {
    const documentCreateMock = jest.fn().mockResolvedValue({
      id: 'document-1',
      receivableId: 'receivable-1',
      type: 'invoice',
      url: 'https://stub/nfe.xml',
      hash: 'a'.repeat(64),
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
    });
    const receivableUpdateMock = jest.fn().mockResolvedValue({});
    const prismaMock = {
      document: {
        create: documentCreateMock,
      },
      receivable: {
        update: receivableUpdateMock,
      },
    } as unknown as PrismaService;
    const repository = new DocumentsRepository(prismaMock);

    await repository.create({
      receivableId: 'receivable-1',
      type: 'invoice',
      url: 'https://stub/nfe.xml',
      hash: 'a'.repeat(64),
    });

    expect(receivableUpdateMock).toHaveBeenCalledWith({
      where: { id: 'receivable-1' },
      data: { documentHash: 'a'.repeat(64) },
    });
  });
});
