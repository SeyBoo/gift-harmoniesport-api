import { PaginationDto } from '../../common/dtos/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class ListFaqDto extends PaginationDto {
  @IsOptional()
  @IsString()
  category?: string;
}
