/** Keep exact prepared bytes across failed uploads/reloads; never re-encode a retry. */
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("speakai-sentence-recordings-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("recordings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "녹음을 이 기기에 보관하지 못했어요. 저장 공간을 확인해 주세요.",
        ),
      );
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("recordings", mode);
      const request = operation(tx.objectStore("recordings"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () =>
        reject(new Error("문장 녹음을 보관하거나 읽지 못했어요."));
    });
  } finally {
    db.close();
  }
}
export const sentenceRecordings = {
  read: (key: string): Promise<Blob | undefined> =>
    transaction("readonly", (store) => store.get(key)),
  put: async (key: string, blob: Blob): Promise<void> => {
    await transaction("readwrite", (store) => store.put(blob, key));
  },
  remove: async (key: string): Promise<void> => {
    await transaction("readwrite", (store) => store.delete(key));
  },
};
