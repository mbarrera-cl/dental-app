import type { MenuItem } from 'data-access';

/** Predicate telling whether a `routeKey` can actually be rendered. */
export type RouteKnown = (routeKey: string) => boolean;

/**
 * Client-side mirror of the backend's `visibleMenuTree`
 * (`src/modules/navigation/domain/menu-tree.ts`): exactly the tree the
 * sidebar would paint for a given permission set. The editor's "view as"
 * preview uses it; the sidebar itself renders the server-filtered tree.
 *
 * Same rules, same order: disabled/permission-less entries drop, unknown
 * route keys never render, groups without visible children disappear and
 * dividers survive only between two visible entries.
 */
export function previewMenuTree(
  tree: readonly MenuItem[],
  permissions: ReadonlySet<string>,
  isRouteKnown: RouteKnown,
): MenuItem[] {
  return prune(filterVisible(tree, permissions, isRouteKnown));
}

function filterVisible(
  items: readonly MenuItem[],
  permissions: ReadonlySet<string>,
  isRouteKnown: RouteKnown,
): MenuItem[] {
  const result: MenuItem[] = [];

  for (const item of items) {
    const permitted =
      item.enabled && (item.requiredPermission === null || permissions.has(item.requiredPermission));

    if (!permitted) {
      continue;
    }

    if (item.kind === 'item') {
      // The sidebar hides items whose route key left the registry.
      const renderable =
        item.externalUrl !== null || (item.routeKey !== null && isRouteKnown(item.routeKey));

      if (renderable) {
        result.push({ ...item, children: [] });
      }

      continue;
    }

    result.push({ ...item, children: filterVisible(item.children, permissions, isRouteKnown) });
  }

  return result;
}

function prune(nodes: readonly MenuItem[]): MenuItem[] {
  const surrounded = nodes.filter((node, index) => {
    if (node.kind !== 'divider') {
      return true;
    }

    const previous = nodes[index - 1];
    const next = nodes[index + 1];

    return previous !== undefined && previous.kind !== 'divider' && next !== undefined && next.kind !== 'divider';
  });

  const kept: MenuItem[] = [];

  for (const node of surrounded) {
    if (node.kind !== 'group') {
      kept.push(node);
      continue;
    }

    const children = prune(node.children);

    if (children.length > 0) {
      kept.push({ ...node, children });
    }
  }

  return kept;
}
