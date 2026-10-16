import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = readFileSync(
  "android/app/src/main/AndroidManifest.xml",
  "utf8",
);

test("Android WebView audio capture permissions are declared together", () => {
  for (const permission of ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"]) {
    assert.match(
      manifest,
      new RegExp(`android\\.permission\\.${permission}`),
      `${permission} must be declared for Capacitor microphone capture`,
    );
  }
});
