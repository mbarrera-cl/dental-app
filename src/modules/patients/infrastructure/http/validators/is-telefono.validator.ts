import { registerDecorator, type ValidationOptions } from 'class-validator';
import { Telefono } from '../../../domain/telefono.vo.js';

/**
 * Validates that a property is a Chilean phone number. Delegates to the
 * `Telefono` value object, so the transport and the domain can never
 * disagree on what a valid phone number is.
 */
export function IsTelefono(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isTelefono',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }

          try {
            Telefono.create(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(): string {
          return '$property must be a valid Chilean phone number (e.g. "+56912345678")';
        },
      },
    });
  };
}
