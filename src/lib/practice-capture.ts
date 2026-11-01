/** Files are produced by encodeMonoWav; validate their real PCM header before reuse. */
export async function pcmCapture(
  blob: Blob,
): Promise<{ blob: Blob; durationMs: number }> {
  const bytes = await blob.slice(0, 44).arrayBuffer();
  const view = new DataView(bytes);
  if (
    bytes.byteLength !== 44 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint16(34, true) !== 16
  )
    throw new Error("문장 녹음 형식을 확인하지 못했어요.");
  const rate = view.getUint32(24, true),
    size = view.getUint32(40, true);
  if (!rate || size !== blob.size - 44 || size % 2)
    throw new Error("문장 녹음 길이를 확인하지 못했어요.");
  return { blob, durationMs: Math.round((size / 2 / rate) * 1000) };
}

/** Specialized legacy/exam sessions still require one authentic full recording. */
export async function joinPcmCaptures(
  blobs: Blob[],
): Promise<{ blob: Blob; durationMs: number; boundaries: number[] }> {
  if (!blobs.length) throw new Error("녹음된 음성이 없어요.");
  const headers = await Promise.all(
    blobs.map((blob) => blob.slice(0, 44).arrayBuffer()),
  );
  const first = new DataView(headers[0]);
  const rate = first.getUint32(24, true);
  let total = 0;
  const boundaries = [0];
  for (let index = 0; index < blobs.length; index++) {
    await pcmCapture(blobs[index]);
    if (new DataView(headers[index]).getUint32(24, true) !== rate)
      throw new Error("문장 녹음 형식이 변경됐어요.");
    total += blobs[index].size - 44;
    boundaries.push(total / 2 / rate);
  }
  first.setUint32(4, 36 + total, true);
  first.setUint32(40, total, true);
  return {
    blob: new Blob([headers[0], ...blobs.map((blob) => blob.slice(44))], {
      type: "audio/wav",
    }),
    durationMs: Math.round((total / 2 / rate) * 1000),
    boundaries,
  };
}
