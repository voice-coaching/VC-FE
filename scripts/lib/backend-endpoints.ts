import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

export type Endpoint = { method: string; path: string; source: string };
const verbs = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const normalize = (path: string) =>
  ("/" + path).replace(/\/+/g, "/").replace(/\/$/, "") || "/";

function files(root: string, extension: RegExp): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? files(path, extension)
      : extension.test(entry.name)
        ? [path]
        : [];
  });
}

/** Ignore retired annotations in comments while preserving quoted Java strings. */
export function controllerEndpoints(input: string, source: string): Endpoint[] {
  const java = input.replace(
    /"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
    (part) => (part.startsWith("/") ? part.replace(/[^\r\n]/g, " ") : part),
  );
  const classIndex = java.search(/\bclass\s+\w+/);
  if (classIndex < 0 || !/@RestController\b/.test(java)) return [];
  let bases = [""];
  const result: Endpoint[] = [];
  for (const match of java.matchAll(
    /@(RequestMapping|GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\b/g,
  )) {
    let end = match.index! + match[0].length;
    while (/\s/.test(java[end] ?? "") && end < java.length) end++;
    let args = "";
    if (java[end] === "(") {
      const start = ++end;
      let depth = 1,
        quoted = false;
      for (; end < java.length; end++) {
        const char = java[end];
        if (char === "\\" && quoted) {
          end++;
          continue;
        }
        if (char === '"') quoted = !quoted;
        if (!quoted && char === "(") depth++;
        if (!quoted && char === ")" && --depth === 0) break;
      }
      args = java.slice(start, end);
    }
    const paths = [...args.matchAll(/"((?:\\.|[^"\\])*)"/g)]
      .map((row) => row[1])
      .filter((path) => path.startsWith("/") || path === "");
    const mapped = paths.length ? paths : [""];
    if (match.index! < classIndex) {
      bases = mapped;
      continue;
    }
    const methods =
      match[1] === "RequestMapping"
        ? [...args.matchAll(/RequestMethod\.(\w+)/g)].map((row) => row[1])
        : [match[1].replace("Mapping", "").toUpperCase()];
    for (const method of methods.length ? methods : verbs)
      for (const base of bases)
        for (const path of mapped)
          result.push({ method, path: normalize(base + "/" + path), source });
  }
  return result;
}

export function backendEndpoints(root: string) {
  return files(join(root, "src/main/java"), /\.java$/).flatMap((path) =>
    controllerEndpoints(readFileSync(path, "utf8"), relative(root, path)),
  );
}

/** Resolve request templates, including base variables, query suffixes and method/path branches. */
export function frontendEndpoints(input: string, source: string): Endpoint[] {
  const file = ts.createSourceFile(
    source,
    input,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = new Map<string, ts.VariableDeclaration[]>();
  const collect = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    )
      declarations.set(node.name.text, [
        ...(declarations.get(node.name.text) ?? []),
        node,
      ]);
    ts.forEachChild(node, collect);
  };
  collect(file);
  function resolve(node: ts.Expression, depth = 0): string[] {
    if (depth > 8) throw new Error(`Unresolved API expression in ${source}`);
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isParenthesizedExpression(node))
      return resolve(node.expression, depth + 1);
    if (ts.isConditionalExpression(node))
      return [
        ...resolve(node.whenTrue, depth + 1),
        ...resolve(node.whenFalse, depth + 1),
      ];
    if (ts.isIdentifier(node) && declarations.has(node.text)) {
      const scopeOf = (value: ts.Node) => {
        let owner = value.parent;
        while (owner && !ts.isBlock(owner) && !ts.isSourceFile(owner))
          owner = owner.parent;
        return owner;
      };
      for (
        let owner: ts.Node | undefined = node.parent;
        owner;
        owner = owner.parent
      ) {
        const local = declarations
          .get(node.text)!
          .filter((value) => scopeOf(value) === owner);
        if (local.length)
          return local.flatMap((value) =>
            resolve(value.initializer!, depth + 1),
          );
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    )
      return resolve(node.left, depth + 1).flatMap((left) =>
        resolve(node.right, depth + 1).map((right) => left + right),
      );
    if (ts.isTemplateExpression(node)) {
      let values = [node.head.text];
      for (const span of node.templateSpans) {
        const suffix =
          ts.isCallExpression(span.expression) &&
          span.expression.expression.getText(file) === "query"
            ? [""]
            : resolve(span.expression, depth + 1);
        values = values.flatMap((value) =>
          suffix.map((part) => value + part + span.literal.text),
        );
      }
      return values;
    }
    return ["{value}"];
  }
  const result: Endpoint[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(file);
      if (
        (name === "request" ||
          name === "requestAudio" ||
          (name.endsWith(".request") && name !== "navigator.locks.request") ||
          name === "fetch") &&
        node.arguments[0]
      ) {
        // Generic transport forwarding is not a second endpoint declaration.
        if (
          /[\\/]api[\\/]client\.ts$/.test(source) &&
          name === "request" &&
          ts.isIdentifier(node.arguments[0]) &&
          node.arguments[0].text === "path"
        )
          return;
        const resolved = resolve(node.arguments[0]);
        const paths =
          name === "fetch"
            ? resolved
                .filter((path) => path.startsWith("/api/backend/api/"))
                .map((path) => path.slice("/api/backend".length))
            : resolved;
        const options = node.arguments[1];
        const property =
          options && ts.isObjectLiteralExpression(options)
            ? options.properties.find(
                (item) =>
                  ts.isPropertyAssignment(item) &&
                  item.name.getText(file) === "method",
              )
            : null;
        const methods =
          property && ts.isPropertyAssignment(property)
            ? resolve(property.initializer)
            : ["GET"];
        for (const path of paths) {
          if (!path.startsWith("/api/"))
            throw new Error(`Unresolved backend request in ${source}: ${path}`);
          for (const method of methods)
            result.push({
              method,
              path: normalize(path.split("?")[0]),
              source,
            });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return result;
}

export function frontendBackendEndpoints(root: string) {
  return files(join(root, "src"), /\.tsx?$/)
    .filter((path) => !/\.test\.tsx?$/.test(path))
    .flatMap((path) =>
      frontendEndpoints(readFileSync(path, "utf8"), relative(root, path)),
    );
}

export function endpointExists(call: Endpoint, routes: Endpoint[]) {
  const wanted = normalize(call.path).split("/");
  return routes.some((route) => {
    const bound = normalize(route.path).split("/");
    return (
      route.method === call.method &&
      bound.length === wanted.length &&
      bound.every(
        (segment, index) =>
          /^\{[^}]+\}$/.test(segment) || segment === wanted[index],
      )
    );
  });
}
