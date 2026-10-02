import { ApiError } from "./api/client";
import type { RecordingUploadUrl } from "./api/types";

function isRejectedUpload(reason: unknown) {
  return (
    reason instanceof ApiError &&
    reason.code === "UPLOAD_AUTHORIZATION_FAILED" &&
    (reason.status === 401 || reason.status === 403)
  );
}

export async function uploadRecordingWithFreshUrl({
  issueUploadUrl,
  upload,
  onRetry,
}: {
  issueUploadUrl: () => Promise<RecordingUploadUrl>;
  upload: (uploadInfo: RecordingUploadUrl) => Promise<void>;
  onRetry?: () => void;
}) {
  let uploadInfo = await issueUploadUrl();

  try {
    await upload(uploadInfo);
  } catch (reason) {
    if (!isRejectedUpload(reason)) throw reason;

    onRetry?.();
    uploadInfo = await issueUploadUrl();
    await upload(uploadInfo);
  }

  return uploadInfo;
}
