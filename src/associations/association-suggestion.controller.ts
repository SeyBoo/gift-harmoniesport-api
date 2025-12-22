import { Controller, Get, Query } from '@nestjs/common';
import { AssociationSuggestionService } from './association-suggestion.service';
import { SuggestAssociationDto } from './association.dto';

@Controller('associations')
export class AssociationSuggestionController {
  constructor(
    private readonly associationSuggestionService: AssociationSuggestionService,
  ) {}

  @Get('suggest')
  async suggestAssociation(@Query() dto: SuggestAssociationDto) {
    return await this.associationSuggestionService.suggestAssociationData(dto.name);
  }
}
