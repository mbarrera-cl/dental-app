import { ApiProperty } from '@nestjs/swagger';
import { MENU_KINDS, type MenuKind, type MenuItem } from '../../../domain/menu-item.entity.js';
import type { MenuTreeNode } from '../../../domain/menu-tree.js';

/** Outbound DTO: one node of the menu tree, children included. */
export class MenuItemResponseDto {
  @ApiProperty({ example: 'e0a7f6a4-2c2e-4d63-9c62-8d1f8f8f8f8f' })
  id: string;

  @ApiProperty({ enum: MENU_KINDS, example: 'item' })
  kind: MenuKind;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Administración',
    description: 'Literal label; `null` falls back to the route registry i18n label.',
  })
  label: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'lucideUsers' })
  icon: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'settings.menu' })
  routeKey: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'https://example.com' })
  externalUrl: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Parent group id (two levels max).' })
  parentId: string | null;

  @ApiProperty({ example: 0, description: 'Position among its siblings.' })
  position: number;

  @ApiProperty({ nullable: true, type: String, example: 'settings:read' })
  requiredPermission: string | null;

  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ type: () => [MenuItemResponseDto] })
  children: MenuItemResponseDto[];

  static fromDomain(item: MenuItem): MenuItemResponseDto {
    return MenuItemResponseDto.of(item, []);
  }

  static fromTree(tree: readonly MenuTreeNode[]): MenuItemResponseDto[] {
    return tree.map((node) =>
      MenuItemResponseDto.of(node.item, MenuItemResponseDto.fromTree(node.children)),
    );
  }

  private static of(item: MenuItem, children: MenuItemResponseDto[]): MenuItemResponseDto {
    const dto = new MenuItemResponseDto();
    dto.id = item.id;
    dto.kind = item.kind;
    dto.label = item.label;
    dto.icon = item.icon;
    dto.routeKey = item.routeKey;
    dto.externalUrl = item.externalUrl;
    dto.parentId = item.parentId;
    dto.position = item.position;
    dto.requiredPermission = item.requiredPermission;
    dto.enabled = item.enabled;
    dto.children = children;
    return dto;
  }
}
