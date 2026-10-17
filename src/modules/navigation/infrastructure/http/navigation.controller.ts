import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../../shared/security/current-principal.decorator.js';
import type { Principal } from '../../../../shared/security/principal.js';
import { RequirePermissions } from '../../../../shared/security/require-permissions.decorator.js';
import { ActivityAction } from '../../../activity/infrastructure/http/activity-action.decorator.js';
import { settingsPermissions } from '../../../settings/permissions.js';
import { CreateMenuItemUseCase } from '../../application/use-cases/create-menu-item.use-case.js';
import { DeleteMenuItemUseCase } from '../../application/use-cases/delete-menu-item.use-case.js';
import { GetMyNavigationUseCase } from '../../application/use-cases/get-my-navigation.use-case.js';
import { ListMenuItemsUseCase } from '../../application/use-cases/list-menu-items.use-case.js';
import { ReorderMenuItemsUseCase } from '../../application/use-cases/reorder-menu-items.use-case.js';
import { ResetMenuUseCase } from '../../application/use-cases/reset-menu.use-case.js';
import { UpdateMenuItemUseCase } from '../../application/use-cases/update-menu-item.use-case.js';
import { CreateMenuItemRequestDto } from './dtos/create-menu-item.request.dto.js';
import { MenuItemResponseDto } from './dtos/menu-item-response.dto.js';
import { ReorderMenuItemsRequestDto } from './dtos/reorder-menu-items.request.dto.js';
import { UpdateMenuItemRequestDto } from './dtos/update-menu-item.request.dto.js';

/**
 * Navigation endpoints. `GET /navigation` is the only one every
 * authenticated principal may call (the sidebar consumes it); the rest are
 * configuration and require `settings:read` / `settings:update`.
 *
 * Hiding entries never grants or revokes access: the route guards remain the
 * single authority, and the anti-lockout reset lives at `POST /reset`.
 */
@ApiTags('navigation')
@Controller('navigation')
export class NavigationController {
  constructor(
    private readonly getMyNavigation: GetMyNavigationUseCase,
    private readonly listMenuItems: ListMenuItemsUseCase,
    private readonly createMenuItem: CreateMenuItemUseCase,
    private readonly updateMenuItem: UpdateMenuItemUseCase,
    private readonly deleteMenuItem: DeleteMenuItemUseCase,
    private readonly reorderMenuItems: ReorderMenuItemsUseCase,
    private readonly resetMenu: ResetMenuUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Menu tree visible to the authenticated principal, filtered by effective permissions',
  })
  @ApiOkResponse({ type: [MenuItemResponseDto] })
  async mine(@CurrentPrincipal() principal: Principal): Promise<MenuItemResponseDto[]> {
    const tree = await this.getMyNavigation.execute({ permissions: principal.permissions });

    return MenuItemResponseDto.fromTree(tree);
  }

  @Get('items')
  @RequirePermissions(settingsPermissions.read)
  @ApiOperation({ summary: 'Full menu tree (including disabled entries), for the editor' })
  @ApiOkResponse({ type: [MenuItemResponseDto] })
  async list(): Promise<MenuItemResponseDto[]> {
    const tree = await this.listMenuItems.execute();

    return MenuItemResponseDto.fromTree(tree);
  }

  @Post('items')
  @RequirePermissions(settingsPermissions.update)
  @ActivityAction({ action: 'navigation.create', subjectType: 'menu-item' })
  @ApiOperation({ summary: 'Create a menu entry (appended at the end of its parent)' })
  @ApiCreatedResponse({ type: MenuItemResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid kind/destination, unknown permission, bad parent or too-long values.',
  })
  async create(
    @Body() body: CreateMenuItemRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MenuItemResponseDto> {
    const item = await this.createMenuItem.execute({
      kind: body.kind,
      label: body.label,
      icon: body.icon,
      routeKey: body.routeKey,
      externalUrl: body.externalUrl,
      parentId: body.parentId,
      requiredPermission: body.requiredPermission,
      enabled: body.enabled,
      actorId: principal.userId,
    });

    return MenuItemResponseDto.fromDomain(item);
  }

  @Patch('items/:id')
  @RequirePermissions(settingsPermissions.update)
  @ActivityAction({ action: 'navigation.update', subjectType: 'menu-item', subjectParam: 'id' })
  @ApiOperation({ summary: 'Update a menu entry (partial; moving belongs to PUT /order)' })
  @ApiOkResponse({ type: MenuItemResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or an empty update.' })
  @ApiNotFoundResponse({ description: 'No menu item with this id exists.' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateMenuItemRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MenuItemResponseDto> {
    const item = await this.updateMenuItem.execute({
      id,
      label: body.label,
      icon: body.icon,
      routeKey: body.routeKey,
      externalUrl: body.externalUrl,
      requiredPermission: body.requiredPermission,
      enabled: body.enabled,
      actorId: principal.userId,
    });

    return MenuItemResponseDto.fromDomain(item);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(settingsPermissions.update)
  @ActivityAction({ action: 'navigation.delete', subjectType: 'menu-item', subjectParam: 'id' })
  @ApiOperation({ summary: 'Delete a menu entry and its children' })
  @ApiNoContentResponse({ description: 'The entry was deleted.' })
  @ApiNotFoundResponse({ description: 'No menu item with this id exists.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteMenuItem.execute({ id });
  }

  @Put('order')
  @RequirePermissions(settingsPermissions.update)
  @ActivityAction({ action: 'navigation.reorder' })
  @ApiOperation({
    summary: 'Apply a drag & drop batch; positions are re-numbered 0..n per parent',
  })
  @ApiOkResponse({ type: [MenuItemResponseDto], description: 'The resulting full menu tree.' })
  @ApiBadRequestResponse({ description: 'Unknown parent, self-parent or duplicated ids.' })
  @ApiNotFoundResponse({ description: 'An id in the payload does not exist.' })
  async reorder(
    @Body() body: ReorderMenuItemsRequestDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<MenuItemResponseDto[]> {
    const tree = await this.reorderMenuItems.execute({
      updates: body.items.map((entry) => ({
        id: entry.id,
        parentId: entry.parentId ?? null,
        position: entry.position,
      })),
      actorId: principal.userId,
    });

    return MenuItemResponseDto.fromTree(tree);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(settingsPermissions.update)
  @ActivityAction({ action: 'navigation.reset' })
  @ApiOperation({ summary: 'Replace the whole menu with the default seed (anti-lockout)' })
  @ApiOkResponse({ type: [MenuItemResponseDto], description: 'The restored default menu tree.' })
  async reset(): Promise<MenuItemResponseDto[]> {
    const tree = await this.resetMenu.execute();

    return MenuItemResponseDto.fromTree(tree);
  }
}
