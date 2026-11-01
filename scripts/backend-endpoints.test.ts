import assert from "node:assert/strict";
import test from "node:test";
import {
  controllerEndpoints,
  frontendEndpoints,
  endpointExists,
} from "./lib/backend-endpoints";

test("controller mappings combine class paths and verbs while ignoring retired comment annotations", () => {
  const routes = controllerEndpoints(
    `
    @RestController @RequestMapping("/api/examples") public class Examples {
      @GetMapping public Object list() { return null; }
      /* @PostMapping("/retired") */
      @PutMapping(path="/{id}", consumes="application/json") public void update() {}
      @RequestMapping(value={"/a","/b"}, method={RequestMethod.GET,RequestMethod.DELETE}) public void aliases() {}
    }
  `,
    "Examples.java",
  );
  assert.deepEqual(
    routes.map((route) => `${route.method} ${route.path}`),
    [
      "GET /api/examples",
      "PUT /api/examples/{id}",
      "GET /api/examples/a",
      "GET /api/examples/b",
      "DELETE /api/examples/a",
      "DELETE /api/examples/b",
    ],
  );
  assert.equal(
    endpointExists(
      { method: "PUT", path: "/api/examples/12", source: "client.ts" },
      routes,
    ),
    true,
  );
  assert.equal(
    endpointExists(
      { method: "POST", path: "/api/examples/12", source: "client.ts" },
      routes,
    ),
    false,
  );
  assert.equal(
    endpointExists(
      { method: "POST", path: "/api/examples/retired", source: "client.ts" },
      routes,
    ),
    false,
  );
});

test("frontend templates preserve nested paths, conditional routes and query suffixes", () => {
  const calls = frontendEndpoints(
    [
      'const base = "/api/examples";',
      "client.request(base);",
      'client.request(`${base}/${id(value)}/${retry ? "retry" : "analyze"}${query(filters)}`, { method: "POST" });',
    ].join("\n"),
    "client.ts",
  );
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.path}`),
    [
      "GET /api/examples",
      "POST /api/examples/{value}/retry",
      "POST /api/examples/{value}/analyze",
    ],
  );
});

test("a shadowed path in another function cannot hide an invalid request or change its audit", () => {
  const calls = frontendEndpoints(
    `
    function unrelated(value) { const path = value.pathname.replace(/x/, ""); }
    function list() { const path = "/api/examples"; return request(path); }
  `,
    "client.ts",
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/examples");
});

test("explicit proxy fetches are audited without treating external AI or browser locks as VC-BE calls", () => {
  const calls = frontendEndpoints(
    [
      'fetch("/api/backend/api/example", { method: "DELETE" });',
      'fetch(endpoint("/api/v1/analyses"), { method: "POST" });',
      'navigator.locks.request("auth-lock", callback);',
    ].join("\n"),
    "client.ts",
  );
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.path}`),
    ["DELETE /api/example"],
  );
});
