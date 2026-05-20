import { BadRequestException } from '@nestjs/common';

export type FinancialAuthorizationErrorCode =
  | 'wallet_required'
  | 'authorization_required'
  | 'authorization_expired'
  | 'authorization_invalid'
  | 'authorization_already_used'
  | 'authorization_operation_mismatch'
  | 'authorization_resource_mismatch';

export class FinancialAuthorizationException extends BadRequestException {
  constructor(code: FinancialAuthorizationErrorCode, message: string) {
    super({ code, message });
  }
}
