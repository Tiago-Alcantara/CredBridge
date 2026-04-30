import { ReceivableType } from '@credbridge/types';

export class CreateReceivableDto {
  userId!: string;
  value!: number;
  type!: ReceivableType;
  dueDate!: string;
}
