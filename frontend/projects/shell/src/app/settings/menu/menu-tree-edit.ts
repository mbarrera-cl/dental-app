import type { MenuItem, MenuReorderEntry } from 'data-access';

/**
 * Pure tree operations backing the editor's drag & drop and up/down buttons.
 * Every function clones before mutating (the caller's signal is never touched)
 * and returns `null` when the move would break a rule the backend enforces
 * too: groups stay top-level and a node can never become its own container.
 */

/** Deep clone so optimistic updates never mutate the previous state. */
export function cloneTree(items: readonly MenuItem[]): MenuItem[] {
  return items.map((item) => ({ ...item, children: cloneTree(item.children) }));
}

/** Depth-first lookup; `null` when the id is not part of the tree. */
export function findNode(items: readonly MenuItem[], id: string): MenuItem | null {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }

    const nested = findNode(item.children, id);

    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

interface Located {
  readonly siblings: MenuItem[];
  readonly index: number;
  readonly node: MenuItem;
}

/** Internal: mutable clone + the sibling array and index of `id`. */
function locate(items: MenuItem[], id: string): Located | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;

    if (item.id === id) {
      return { siblings: items, index, node: item };
    }

    const nested = locate(item.children, id);

    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

/** Moves a node one slot up (`-1`) or down (`+1`) among its siblings. */
export function shiftNode(tree: readonly MenuItem[], id: string, delta: number): MenuItem[] | null {
  const next = cloneTree(tree);
  const located = locate(next, id);

  if (located === null) {
    return null;
  }

  const target = located.index + delta;

  if (target < 0 || target >= located.siblings.length) {
    return null;
  }

  located.siblings.splice(target, 0, ...located.siblings.splice(located.index, 1));
  normalizePositions(located.siblings);

  return next;
}

/** One CDK drop translated to domain terms. */
export interface DropMove {
  readonly movedId: string;
  /** Destination container: `null` = top level, otherwise the group id. */
  readonly toParentId: string | null;
  readonly toIndex: number;
  /**
   * Same-list move. CDK semantics: `toIndex` already accounts for the
   * removal of the dragged element (`moveItemInArray` behavior).
   */
  readonly sameList: boolean;
}

/**
 * Applies a drop: validates it, moves the node across (or within) containers
 * and re-numbers the positions of both affected sibling lists.
 */
export function dropNode(tree: readonly MenuItem[], move: DropMove): MenuItem[] | null {
  const next = cloneTree(tree);
  const source = locate(next, move.movedId);

  if (source === null) {
    return null;
  }

  // Groups are top-level only (two levels max): never inside another group.
  if (source.node.kind === 'group' && move.toParentId !== null) {
    return null;
  }

  if (move.toParentId === source.node.id) {
    return null;
  }

  const target = containerOf(next, move.toParentId);

  if (target === null) {
    return null;
  }

  if (move.sameList && source.siblings !== target) {
    return null;
  }

  const [moved] = source.siblings.splice(source.index, 1);

  if (moved === undefined) {
    return null;
  }

  moved.parentId = move.toParentId;
  target.splice(clamp(move.toIndex, 0, target.length), 0, moved);
  normalizePositions(source.siblings);
  normalizePositions(target);

  return next;
}

/** `null` for the top level; the group's `children` array otherwise. */
function containerOf(tree: MenuItem[], parentId: string | null): MenuItem[] | null {
  if (parentId === null) {
    return tree;
  }

  const parent = locate(tree, parentId);

  if (parent === null || parent.node.kind !== 'group') {
    return null;
  }

  return parent.node.children;
}

/** Flattens the whole tree into the `PUT /navigation/order` payload. */
export function toReorderEntries(tree: readonly MenuItem[]): MenuReorderEntry[] {
  const entries: MenuReorderEntry[] = [];
  collect(tree, null, entries);

  return entries;
}

function collect(
  items: readonly MenuItem[],
  parentId: string | null,
  entries: MenuReorderEntry[],
): void {
  items.forEach((item, position) => {
    entries.push({ id: item.id, parentId, position });
    collect(item.children, item.id, entries);
  });
}

function normalizePositions(siblings: readonly MenuItem[]): void {
  siblings.forEach((item, position) => {
    item.position = position;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
