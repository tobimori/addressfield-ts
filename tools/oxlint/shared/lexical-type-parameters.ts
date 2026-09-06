import type { ESTree } from "@oxlint/plugins";

type VisitorKeys = Readonly<Record<string, readonly string[]>>;

function collectInferTypeParameterNames(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
  names: Set<string>,
) {
  if (node.type === "TSInferType") names.add(node.typeParameter.name.name);
  for (const key of visitorKeys[node.type] ?? []) {
    const value = Object.getOwnPropertyDescriptor(node, key)?.value;
    if (value === null || value === undefined) continue;
    if (!Array.isArray(value)) {
      collectInferTypeParameterNames(value, visitorKeys, names);
      continue;
    }
    for (const child of value) collectInferTypeParameterNames(child, visitorKeys, names);
  }
}

/** Collect type binders that are in scope at a node and can shadow module aliases. */
export function lexicalTypeParameterNames(node: ESTree.Node, visitorKeys: VisitorKeys) {
  const names = new Set<string>();
  let descendant: ESTree.Node = node;
  let current: ESTree.Node | null = node;
  while (current !== null && current.type !== "Program") {
    if ("typeParameters" in current) {
      for (const parameter of current.typeParameters?.params ?? []) {
        names.add(parameter.name.name);
      }
    }
    if (
      current.type === "TSMappedType" &&
      (descendant === current.nameType || descendant === current.typeAnnotation)
    ) {
      names.add(current.key.name);
    }
    if (current.type === "TSConditionalType" && descendant === current.trueType) {
      collectInferTypeParameterNames(current.extendsType, visitorKeys, names);
    }
    descendant = current;
    current = current.parent;
  }
  return names;
}
