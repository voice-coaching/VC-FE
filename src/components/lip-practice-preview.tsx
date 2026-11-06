"use client";
import { useEffect, useState } from "react";
import { LipQuickStart } from "./lip-quick-start";
import {
  LipFaceAlignment,
  LipPermissionDialog,
  type LipPermission,
} from "./lip-flow-overlays";
import { AppShell } from "./app-shell";
import { LIP_PRACTICE_SETS } from "@/lib/lip-practice-sets";
export function LipPracticePreview() {
  const [selected, setSelected] = useState(LIP_PRACTICE_SETS[1]);
  const [permission, setPermission] = useState<LipPermission | null>(null);
  const [align, setAlign] = useState(false);
  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get("permission");
    if (state === "both" || state === "camera" || state === "microphone")
      setPermission(state);
  }, []);
  return (
    <AppShell
      nav={false}
      viewportLocked
      animateRoute={false}
      chromeColor={align ? "#12161f" : "#ffffff"}
      bottomChromeColor={align ? "#12161f" : "#ffffff"}
    >
      {align ? (
        <LipFaceAlignment
          onClose={() => setAlign(false)}
          onReady={() => setAlign(false)}
        />
      ) : (
        <LipQuickStart
          preview
          selected={selected}
          onSelect={setSelected}
          onStart={() => setPermission("request")}
        />
      )}
      <LipPermissionDialog
        state={permission}
        onClose={() => setPermission(null)}
        onAllow={() => {
          setPermission(null);
          setAlign(true);
        }}
      />
    </AppShell>
  );
}
