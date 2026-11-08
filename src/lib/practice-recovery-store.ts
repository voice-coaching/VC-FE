export interface RecoveryStore {
  read<T>(userId: string, scope: string): Promise<T | undefined>;
  write<T>(userId: string, scope: string, value: T): Promise<void>;
  remove(userId: string, scope: string): Promise<void>;
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("speakai-practice-recovery-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("attempts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () =>
      reject(
        new Error(
          "복구 정보를 이 기기에 저장하지 못했습니다. 저장 공간을 확인해 주세요.",
        ),
      );
  });
}

async function transaction<T>(
  userId: string,
  scope: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, key: string) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("attempts", mode);
      const request = operation(
        tx.objectStore("attempts"),
        JSON.stringify([userId, scope]),
      );
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "녹음과 복구 정보를 보관하거나 읽지 못했습니다. 요청을 다시 보내지 않았습니다.",
          ),
        );
    });
  } finally {
    db.close();
  }
}

/** Await the transaction commit before HTTP. Blobs and metadata share one atomic record. No tokens/signed URLs. */
export const practiceRecoveryStore: RecoveryStore = {
  read: <T>(userId: string, scope: string) =>
    transaction<T | undefined>(userId, scope, "readonly", (store, key) =>
      store.get(key),
    ),
  write: async (userId, scope, value) => {
    await transaction(userId, scope, "readwrite", (store, key) =>
      store.put(value, key),
    );
  },
  remove: async (userId, scope) => {
    await transaction(userId, scope, "readwrite", (store, key) =>
      store.delete(key),
    );
  },
};
