"use client";
import { PracticePlayer } from "@/components/practice-player";
import type { ComponentProps } from "react";

export function NewsPlayer({
  duration = 38,
  ...props
}: ComponentProps<typeof PracticePlayer>) {
  return <PracticePlayer duration={duration} {...props} />;
}
