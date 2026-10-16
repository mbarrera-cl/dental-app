import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION_CATEGORIES } from '../../../../shared/security/permissions.js';
import { PermissionCatalogResponseDto } from './dtos/permission-catalog-response.dto.js';

/**
 * Exposes the code-defined permission catalog. Any authenticated user may
 * read it: the shell needs it to hide navigation and actions the user cannot
 * perform anyway (enforcement always happens server-side).
 */
@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  @Get()
  @ApiOperation({ summary: 'List the permission catalog, grouped by category' })
  @ApiOkResponse({ type: PermissionCatalogResponseDto })
  findAll(): PermissionCatalogResponseDto {
    return PermissionCatalogResponseDto.fromCategories(PERMISSION_CATEGORIES);
  }
}
