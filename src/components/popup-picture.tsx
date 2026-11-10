"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { PopupImage } from "@/lib/popup-image";

/** Signed private URLs bypass the optimizer; expiry and download failure leave the text usable. */
export function PopupPicture({
  image,
  title,
}: {
  image: PopupImage;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const tick = () => {
      const left = Date.parse(image.expiresAt) - Date.now();
      if (left <= 0) {
        setExpired(true);
        return;
      }
      timer = setTimeout(tick, Math.min(left, 86_400_000));
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    tick();
    return () => clearTimeout(timer);
  }, [image.expiresAt]);
  if (failed || expired) return null;
  return (
    <Image
      unoptimized
      src={image.url}
      alt={`${title} 안내 이미지`}
      width={800}
      height={600}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: 360,
        objectFit: "contain",
        borderRadius: 12,
      }}
    />
  );
}
