import { copyFile } from "node:fs/promises";

const favicon = new URL("../public/favicon.svg", import.meta.url);
const nativeIconSources = [
  new URL("../assets/icon-only.svg", import.meta.url),
  new URL("../assets/icon-foreground.svg", import.meta.url),
];

await Promise.all(
  nativeIconSources.map((nativeIconSource) =>
    copyFile(favicon, nativeIconSource),
  ),
);
