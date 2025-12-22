import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PaginationDto } from '../dtos';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginationException } from '../exceptions';

export const Pagination = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationDto => {
    const request = ctx.switchToHttp().getRequest();
    const { page = 1, limit = 10 } = request.query;

    const paginationDto = plainToInstance(PaginationDto, {
      page: Number(page),
      limit: Number(limit),
      search: request.query.search,
      filter: request.query.filter ? JSON.parse(request.query.filter) : null,
    });

    const errors = validateSync(paginationDto);

    if (errors.length > 0) {
      throw new PaginationException(errors);
    }

    return paginationDto;
  },
);
