const DEFAULT_PREVIEW_LIMIT = 64 * 1024;

/**
 * Read only a bounded prefix of an HTTP response body.
 * The upstream stream is cancelled once the preview is complete so debug and
 * diagnostic paths cannot buffer an attacker-controlled response into RAM.
 */
export async function readBoundedTextPreview(
  response: Response,
  maxBytes = DEFAULT_PREVIEW_LIMIT,
): Promise<{ preview: string; truncated: boolean }> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('maxBytes must be a positive integer');
  if (!response.body) return { preview: '', truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        truncated = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }

    if (!truncated && total >= maxBytes) {
      const { done } = await reader.read();
      truncated = !done;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { preview: new TextDecoder().decode(merged), truncated };
}
