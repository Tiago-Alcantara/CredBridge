import { Module } from '@nestjs/common';
import { AnchorService } from './anchor.service';
import { AnchorController } from './anchor.controller';

@Module({
  controllers: [AnchorController],
  providers: [AnchorService],
  exports: [AnchorService],
})
export class AnchorModule {}
