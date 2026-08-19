const HELPER_NAMES = ["DomWindowHelper", "DomDocumentHelper"];

function isNullableHelperCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (!callee || callee.type !== "MemberExpression" || callee.computed) return false;
  if (!callee.object || callee.object.type !== "Identifier") return false;
  if (HELPER_NAMES.indexOf(callee.object.name) === -1) return false;
  const name = callee.property && callee.property.name;
  if (!name) return false;
  return name.indexOf("get") === 0 || name === "matchMedia" || name === "requestAnimationFrame";
}

function isVar(node, name) {
  return !!node && node.type === "Identifier" && node.name === name;
}

function isNullish(node) {
  if (!node) return false;
  if (node.type === "Literal" && node.value === null) return true;
  return node.type === "Identifier" && node.name === "undefined";
}

function isTypeofVar(node, name) {
  return !!node && node.type === "UnaryExpression" && node.operator === "typeof" && isVar(node.argument, name);
}

function isUndefinedString(node) {
  return !!node && node.type === "Literal" && node.value === "undefined";
}

function comparesToNullish(node, name, operators) {
  if (!node || node.type !== "BinaryExpression") return false;
  if (operators.indexOf(node.operator) === -1) return false;
  if (isVar(node.left, name) && isNullish(node.right)) return true;
  if (isVar(node.right, name) && isNullish(node.left)) return true;
  if (isTypeofVar(node.left, name) && isUndefinedString(node.right)) return true;
  if (isTypeofVar(node.right, name) && isUndefinedString(node.left)) return true;
  return false;
}

function asserts(test, name) {
  if (!test) return false;
  switch (test.type) {
    case "Identifier":
      return test.name === name;
    case "UnaryExpression":
      return test.operator === "!" &&
        test.argument.type === "UnaryExpression" && test.argument.operator === "!" &&
        asserts(test.argument.argument, name);
    case "BinaryExpression":
      return comparesToNullish(test, name, ["!==", "!="]);
    case "LogicalExpression":
      if (test.operator === "&&") return asserts(test.left, name) || asserts(test.right, name);
      if (test.operator === "||") return asserts(test.left, name) && asserts(test.right, name);
      return false;
    default:
      return false;
  }
}

function negates(test, name) {
  if (!test) return false;
  switch (test.type) {
    case "UnaryExpression":
      return test.operator === "!" && isVar(test.argument, name);
    case "BinaryExpression":
      return comparesToNullish(test, name, ["===", "=="]);
    case "LogicalExpression":
      if (test.operator === "||") return negates(test.left, name) || negates(test.right, name);
      if (test.operator === "&&") return negates(test.left, name) && negates(test.right, name);
      return false;
    default:
      return false;
  }
}

function isPositionallyGuarded(identifier, name) {
  let node = identifier;
  let parent = node.parent;
  while (parent) {
    if (parent.type === "LogicalExpression") {
      if (parent.operator === "&&" && parent.right === node && asserts(parent.left, name)) return true;
      if (parent.operator === "||" && parent.right === node && negates(parent.left, name)) return true;
    }
    if (parent.type === "ConditionalExpression") {
      if (parent.consequent === node && asserts(parent.test, name)) return true;
      if (parent.alternate === node && negates(parent.test, name)) return true;
    }
    if (parent.type === "IfStatement") {
      if (parent.consequent === node && asserts(parent.test, name)) return true;
      if (parent.alternate === node && negates(parent.test, name)) return true;
    }
    node = parent;
    parent = parent.parent;
  }
  return false;
}

function exits(node) {
  if (!node) return false;
  if (node.type === "ReturnStatement" || node.type === "ThrowStatement") return true;
  if (node.type === "ContinueStatement" || node.type === "BreakStatement") return true;
  if (node.type === "BlockStatement") return node.body.some(exits);
  return false;
}

function isGuardStatement(statement, name) {
  if (!statement || statement.type !== "IfStatement") return false;
  if (!negates(statement.test, name)) return false;
  return exits(statement.consequent);
}

function isEarlyReturnGuarded(identifier, name) {
  let node = identifier;
  while (node && node.parent) {
    const parent = node.parent;
    let body = null;
    if (parent.type === "BlockStatement" || parent.type === "Program") body = parent.body;
    if (parent.type === "SwitchCase") body = parent.consequent;
    if (body) {
      const index = body.indexOf(node);
      for (let i = 0; i < index; i++) {
        if (isGuardStatement(body[i], name)) return true;
      }
    }
    node = parent;
  }
  return false;
}

function findVariable(scope, name) {
  let current = scope;
  while (current) {
    const variable = current.variables.filter(item => item.name === name)[0];
    if (variable) return variable;
    current = current.upper;
  }
  return null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Require a null check before accessing members of a DomWindowHelper/DomDocumentHelper result"
    },
    schema: [],
    messages: {
      directAccess: "'{{helper}}.{{method}}()' returns null outside the browser. Use '?.' or assign the result to a variable and check it before accessing members.",
      unguardedVariable: "'{{name}}' comes from a DomWindowHelper/DomDocumentHelper method and may be null outside the browser. Add a check (for example 'if (!{{name}}) return;') or use '?.' before accessing its members."
    }
  },
  create(context) {
    const declarations = [];
    const getScope = node => {
      const sourceCode = context.sourceCode || context.getSourceCode();
      return sourceCode.getScope ? sourceCode.getScope(node) : context.getScope();
    };
    return {
      MemberExpression(node) {
        if (node.optional) return;
        if (!isNullableHelperCall(node.object)) return;
        context.report({
          node,
          messageId: "directAccess",
          data: {
            helper: node.object.callee.object.name,
            method: node.object.callee.property.name
          }
        });
      },
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier") return;
        if (!isNullableHelperCall(node.init)) return;
        declarations.push({ node: node, scope: getScope(node) });
      },
      "Program:exit"() {
        declarations.forEach(declaration => {
          const name = declaration.node.id.name;
          const variable = findVariable(declaration.scope, name);
          if (!variable) return;
          variable.references.forEach(reference => {
            if (reference.init) return;
            const identifier = reference.identifier;
            const parent = identifier.parent;
            if (!parent || parent.type !== "MemberExpression") return;
            if (parent.object !== identifier || parent.optional) return;
            if (isPositionallyGuarded(identifier, name)) return;
            if (isEarlyReturnGuarded(identifier, name)) return;
            context.report({ node: parent, messageId: "unguardedVariable", data: { name: name } });
          });
        });
      }
    };
  }
};
