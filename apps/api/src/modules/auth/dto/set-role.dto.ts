import { IsIn } from 'class-validator';

export class SetRoleDto {
  @IsIn(['pme', 'investor'])
  role!: 'pme' | 'investor';
}
