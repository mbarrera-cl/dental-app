import type { MenuItem } from './menu-item.entity.js';

/** One node of the menu tree: the entity plus its (nested) children. */
export interface MenuTreeNode {
  readonly item: MenuItem;
  readonly children: readonly MenuTreeNode[];
}

/**
 * Builds the tree from a flat list, ordering siblings by `position` (ties
 * keep the input order, which the repository exposes as insertion order).
 * Orphans are impossible while the foreign key cascade is in place; if one
 * ever appeared it would simply be dropped.
 */
export function buildMenuTree(items: readonly MenuItem[]): MenuTreeNode[] {
  const childrenByParent = new Map<string | null, MenuItem[]>();

  for (const item of items) {
    const siblings = childrenByParent.get(item.parentId);

    if (siblings === undefined) {
      childrenByParent.set(item.parentId, [item]);
      continue;
    }

    siblings.push(item);
  }

  const build = (parentId: string | null): MenuTreeNode[] =>
    (childrenByParent.get(parentId) ?? [])
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((item) => ({ item, children: build(item.id) }));

  return build(null);
}

/**
 * The tree a principal is allowed to see: disabled entries and entries whose
 * permission the principal does not hold are dropped, groups without any
 * visible child are pruned, and dividers survive only when they separate two
 * visible entries.
 */
export function visibleMenuTree(
  items: readonly MenuItem[],
  permissions: ReadonlySet<string>,
): MenuTreeNode[] {
  const visible = items.filter(
    (item) =>
      item.enabled &&
      (item.requiredPermission === null || permissions.has(item.requiredPermission)),
  );

  return prune(buildMenuTree(visible));
}

function prune(nodes: readonly MenuTreeNode[]): MenuTreeNode[] {
  const kept: MenuTreeNode[] = [];

  for (const node of pruneOrphanDividers(nodes)) {
    if (node.item.kind !== 'group') {
      kept.push(node);
      continue;
    }

    const children = prune(node.children);

    if (children.length > 0) {
      kept.push({ item: node.item, children });
    }
  }

  return kept;
}

/** Keeps a divider only when visible entries surround it. */
function pruneOrphanDividers(nodes: readonly MenuTreeNode[]): MenuTreeNode[] {
  return nodes.filter((node, index) => {
    if (node.item.kind !== 'divider') {
      return true;
    }

    const previous = nodes[index - 1];
    const next = nodes[index + 1];

    return (
      previous !== undefined &&
      previous.item.kind !== 'divider' &&
      next !== undefined &&
      next.item.kind !== 'divider'
    );
  });
}
