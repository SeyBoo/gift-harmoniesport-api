import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsOptional, validateSync, IsNumber } from 'class-validator';
import { PaginationException } from '../exceptions';

export class CoordinatesDto {
  @IsOptional()
  @Transform(({ value }) => {
    const parsedValue = parseFloat(value);
    return isNaN(parsedValue) ? null : parsedValue;
  })
  @Type(() => Number)
  @IsNumber()
  lat?: number | null;

  @IsOptional()
  @Transform(({ value }) => {
    const parsedValue = parseFloat(value);
    return isNaN(parsedValue) ? null : parsedValue;
  })
  @Type(() => Number)
  @IsNumber()
  lng?: number | null;
}

export const Coordinates = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CoordinatesDto => {
    const request = ctx.switchToHttp().getRequest();
    const { lat, lng } = request.query;

    const coordinatesDto = plainToInstance(CoordinatesDto, {
      lat: lat !== undefined ? lat : null,
      lng: lng !== undefined ? lng : null,
    });

    const errors = validateSync(coordinatesDto);

    if (errors.length > 0) {
      throw new PaginationException(errors);
    }

    return coordinatesDto;
  },
);
