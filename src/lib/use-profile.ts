"use client";

import { useCallback, useEffect, useState } from "react";
import type { OnboardingProfile } from "./app-data";
import { api, type OnboardingAnswers } from "./api";

const KEY = "voco.profile";

export function readProfile(): OnboardingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingProfile) : null;
  } catch {
    return null;
  }
}

export function writeProfile(profile: OnboardingProfile) {
  window.localStorage.setItem(KEY, JSON.stringify(profile));
}

export function useProfile() {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    api.onboarding
      .get()
      .then((value) => {
        if (!active) return;
        setProfile(value ?? readProfile());
      })
      .catch(() => {
        if (active) setProfile(readProfile());
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (p: OnboardingAnswers) => {
    const saved = await api.onboarding.save(p);
    writeProfile(saved);
    setProfile(saved);
    return saved;
  }, []);

  return { profile, hydrated, save };
}
