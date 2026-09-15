"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  src,
  alt = "프로필 사진",
  size = 60,
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const imageSource = src && !broken ? src : "/figma/mypage/avatar.svg";

  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-[#edf2ff]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={imageSource}
        alt={alt}
        fill
        sizes={`${size}px`}
        unoptimized={Boolean(src)}
        className="object-cover"
        onError={() => setBroken(true)}
      />
    </span>
  );
}
