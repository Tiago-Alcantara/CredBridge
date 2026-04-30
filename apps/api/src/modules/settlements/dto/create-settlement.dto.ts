import { SettlementMethod } from '@credbridge/types';

export class CreateSettlementDto {
  receivableId!: string;
  amount!: number;
  method!: SettlementMethod;
}
