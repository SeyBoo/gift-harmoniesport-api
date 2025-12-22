import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AssociationSuggestionController } from './association-suggestion.controller';
import { AssociationSuggestionService } from './association-suggestion.service';
import { UploadModule } from '../common/upload/upload.module';
import { TranslatorModule } from '../common/translator/translator.module';

@Module({
  imports: [HttpModule, UploadModule, TranslatorModule],
  controllers: [AssociationSuggestionController],
  providers: [AssociationSuggestionService],
})
export class AssociationModule {}
