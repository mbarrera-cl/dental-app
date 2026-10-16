import { ApiProperty } from '@nestjs/swagger';
import type { PermissionCategory } from '../../../../../shared/security/permission-catalog.js';

/** One action of a category, as exposed to API consumers and the panel. */
export class PermissionActionResponseDto {
  @ApiProperty({ example: 'users:reset-password' })
  key: string;

  @ApiProperty({ example: 'resetPassword' })
  action: string;

  @ApiProperty({ example: 'Reset user passwords (typed or generated)' })
  description: string;
}

/** One permission category (one bounded context). */
export class PermissionCategoryResponseDto {
  @ApiProperty({ example: 'users' })
  id: string;

  @ApiProperty({ example: 'User administration' })
  description: string;

  @ApiProperty({ type: [PermissionActionResponseDto] })
  permissions: PermissionActionResponseDto[];
}

/** The whole catalog, grouped by category — what the role editor renders. */
export class PermissionCatalogResponseDto {
  @ApiProperty({ type: [PermissionCategoryResponseDto] })
  categories: PermissionCategoryResponseDto[];

  static fromCategories(categories: readonly PermissionCategory[]): PermissionCatalogResponseDto {
    const dto = new PermissionCatalogResponseDto();

    dto.categories = categories.map((category) => {
      const categoryDto = new PermissionCategoryResponseDto();
      categoryDto.id = category.id;
      categoryDto.description = category.description;
      categoryDto.permissions = Object.entries(category.actions).map(([action, description]) => {
        const permission = new PermissionActionResponseDto();
        permission.key = category.keys[action as keyof typeof category.keys] ?? `${category.id}:${action}`;
        permission.action = action;
        permission.description = description;
        return permission;
      });
      return categoryDto;
    });

    return dto;
  }
}
