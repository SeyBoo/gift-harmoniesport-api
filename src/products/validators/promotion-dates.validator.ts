import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsPromotionEndDateValid(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isPromotionEndDateValid',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as any;

          // If no end date is set, it's valid
          if (!value) {
            return true;
          }

          // If no start date is set, end date is valid
          if (!dto.promotionStartDate) {
            return true;
          }

          // Ensure end date is after start date
          const startDate = new Date(dto.promotionStartDate);
          const endDate = new Date(value);

          return endDate > startDate;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Promotion end date must be after start date';
        },
      },
    });
  };
}
