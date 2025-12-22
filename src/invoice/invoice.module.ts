import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { UploadModule } from '../common/upload/upload.module';

@Module({
  imports: [UploadModule],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
