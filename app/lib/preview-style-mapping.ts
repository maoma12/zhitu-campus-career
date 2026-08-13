export function pairAlignedCloneNodes<T>(
  sourceNodes: readonly T[],
  clonedNodes: readonly T[],
): Array<readonly [T, T]> {
  if (sourceNodes.length !== clonedNodes.length) {
    throw new Error("Preview clone structure changed before style mapping");
  }
  return sourceNodes.map((sourceNode, index) => [sourceNode, clonedNodes[index]] as const);
}
