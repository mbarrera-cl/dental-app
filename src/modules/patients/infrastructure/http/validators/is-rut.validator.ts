import { registerDecorator, type ValidationOptions } from 'class-validator';
import { Rut } from '../../../domain/rut.vo.js';

/**
 * Validates that a property is a Chilean RUT with a correct check digit
 * (módulo 11). Delegates to the `Rut` value object, so the transport and the
 * domain can never disagree on what a valid RUT is.
 */
export function IsRut(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isRut',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }

          try {
            Rut.create(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(): string {
          return '$property must be a valid Chilean RUT (e.g. "12345678-5")';
        },
      },
    });
  };
}
