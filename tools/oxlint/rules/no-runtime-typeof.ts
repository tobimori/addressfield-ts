import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

// RETURN TYPE: This predicate narrows an ESTree node to nodes with runtime return types.
function isRuntimeFunction(
  node: ESTree.Node,
): node is ESTree.ArrowFunctionExpression | ESTree.Function {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  );
}

function isInsideTypeGuard(node: ESTree.Node) {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) {
      return current.returnType?.typeAnnotation.type === "TSTypePredicate";
    }
    current = current.parent;
  }
  return false;
}

/** Disallow runtime typeof checks that narrow unparsed values instead of decoding them. */
export const noRuntimeTypeofRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary.",
    },
    messages: {
      runtimeTypeof:
        "A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowInTypeGuards: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypeGuards: false }],
  },
  createOnce(context) {
    return {
      UnaryExpression(node) {
        const option = context.options[0];
        const allowInTypeGuards =
          option instanceof Object &&
          "allowInTypeGuards" in option &&
          option.allowInTypeGuards === true;
        if (node.operator === "typeof" && (!allowInTypeGuards || !isInsideTypeGuard(node))) {
          context.report({ node, messageId: "runtimeTypeof" });
        }
      },
    };
  },
});
