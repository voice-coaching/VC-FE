import { resolve } from "node:path";
import {
  backendEndpoints,
  frontendBackendEndpoints,
  endpointExists,
} from "./lib/backend-endpoints";

const frontend = resolve(".");
const backend = resolve(
  process.argv[2] ?? process.env.VC_BE_ROOT ?? "../VC-BE",
);
const routes = backendEndpoints(backend);
const calls = frontendBackendEndpoints(frontend);
if (!routes.length || !calls.length)
  throw new Error("API endpoint inventory is empty");
const missing = calls.filter((call) => !endpointExists(call, routes));
for (const call of missing)
  console.error(`${call.method} ${call.path} — ${call.source}`);
console.log(
  `VC-BE endpoint audit: ${calls.length} frontend call variants, ${routes.length} backend mappings, ${missing.length} missing`,
);
if (missing.length) process.exitCode = 1;
