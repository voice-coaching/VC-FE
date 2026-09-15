"use client";
import { Camera, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { TopBar } from "@/components/top-bar";
import { api } from "@/lib/api";
import { getCachedUser, markAuthenticatedUser } from "@/lib/auth-session";

const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export default function ProfileSettings() {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState(
    getCachedUser()?.profileImageUrl ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [imageAction, setImageAction] = useState<"upload" | "delete" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cached = getCachedUser();
    Promise.all([
      cached ? Promise.resolve(cached) : api.users.getMe(),
      api.users.getProfileImage().catch(() => null),
    ])
      .then(([user, image]) => {
        const imageUrl = image?.imageUrl ?? user.profileImageUrl;
        setNickname(user.nickname);
        setEmail(user.email ?? "");
        setProfileImageUrl(imageUrl);
        markAuthenticatedUser({ ...user, profileImageUrl: imageUrl });
      })
      .catch(() => setMessage("프로필을 불러오지 못했습니다."));
  }, []);

  function updateCachedProfileImage(imageUrl: string | null) {
    const cached = getCachedUser();
    if (cached) markAuthenticatedUser({ ...cached, profileImageUrl: imageUrl });
  }

  async function uploadProfileImage(file: File) {
    setMessage(null);
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setMessage("JPG, PNG, WebP 이미지만 사용할 수 있습니다.");
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setMessage("프로필 사진은 5MB 이하로 선택해 주세요.");
      return;
    }

    setImageAction("upload");
    try {
      const input = { file, fileName: file.name };
      const image = profileImageUrl
        ? await api.users.updateProfileImage(input)
        : await api.users.createProfileImage(input);
      setProfileImageUrl(image.imageUrl);
      updateCachedProfileImage(image.imageUrl);
      setMessage(
        profileImageUrl
          ? "프로필 사진을 변경했습니다."
          : "프로필 사진을 등록했습니다.",
      );
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "프로필 사진을 저장하지 못했습니다.",
      );
    } finally {
      setImageAction(null);
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  async function deleteProfileImage() {
    if (!profileImageUrl || !window.confirm("프로필 사진을 삭제할까요?"))
      return;
    setImageAction("delete");
    setMessage(null);
    try {
      await api.users.deleteProfileImage();
      setProfileImageUrl(null);
      updateCachedProfileImage(null);
      setMessage("프로필 사진을 삭제했습니다.");
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "프로필 사진을 삭제하지 못했습니다.",
      );
    } finally {
      setImageAction(null);
    }
  }

  return (
    <AppShell nav={false} className="flex min-h-dvh flex-col !bg-white">
      <TopBar to="/mypage/settings" title="프로필 수정" />
      <div className="flex-1 space-y-6 px-6 pt-8">
        <section
          className="flex flex-col items-center"
          aria-label="프로필 사진"
        >
          <ProfileAvatar src={profileImageUrl} size={96} />
          <div className="mt-4 flex items-center gap-2">
            <input
              ref={imageInput}
              type="file"
              accept={PROFILE_IMAGE_TYPES.join(",")}
              className="sr-only"
              aria-label="프로필 사진 파일 선택"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadProfileImage(file);
              }}
            />
            <button
              type="button"
              disabled={imageAction !== null}
              onClick={() => imageInput.current?.click()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#edf2ff] px-4 text-sm font-semibold text-primary disabled:opacity-50"
            >
              <Camera className="size-4" />
              {imageAction === "upload"
                ? "저장 중…"
                : profileImageUrl
                  ? "사진 변경"
                  : "사진 추가"}
            </button>
            {profileImageUrl && (
              <button
                type="button"
                disabled={imageAction !== null}
                onClick={() => void deleteProfileImage()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#f7f8fa] px-4 text-sm font-semibold text-[#6b7684] disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                {imageAction === "delete" ? "삭제 중…" : "사진 삭제"}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-[#8b95a1]">
            JPG, PNG, WebP · 최대 5MB
          </p>
        </section>
        <label className="block text-sm text-[#6b7684]">
          이메일
          <input
            value={email}
            disabled
            className="mt-2 h-14 w-full rounded-xl bg-[#f7f8fa] px-4 text-[#8b95a1]"
          />
        </label>
        <label className="block text-sm text-[#6b7684]">
          닉네임
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={10}
            className="mt-2 h-14 w-full rounded-xl bg-[#f7f8fa] px-4 text-[#191f28] outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="mt-2 block text-right text-xs text-[#8b95a1]">
            {nickname.length}/10
          </span>
        </label>
        {message && (
          <p role="status" className="text-sm text-[#6b7684]">
            {message}
          </p>
        )}
      </div>
      <div className="p-6 pb-10">
        <button
          className="design-action"
          disabled={saving || !nickname.trim() || nickname.length > 10}
          onClick={async () => {
            setSaving(true);
            try {
              await api.users.updateProfile({ nickname: nickname.trim() });
              const cached = getCachedUser();
              if (cached)
                markAuthenticatedUser({ ...cached, nickname: nickname.trim() });
              setMessage("프로필을 저장했습니다.");
            } catch (reason) {
              setMessage(
                reason instanceof Error
                  ? reason.message
                  : "저장하지 못했습니다.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "저장 중…" : "저장하기"}
        </button>
      </div>
    </AppShell>
  );
}
