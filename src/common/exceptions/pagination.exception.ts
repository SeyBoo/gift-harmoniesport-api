import { BadRequestException, ValidationError } from '@nestjs/common';

export class PaginationException extends BadRequestException {
  constructor(validationErrors: ValidationError[]) {
    super({
      statusCode: 400,
      error: 'Bad Request',
      message: validationErrors.map((error) =>
        Object.values(error.constraints).join(', '),
      ),
    });
  }
}
