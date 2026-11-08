import { Capacitor, registerPlugin } from "@capacitor/core";
import type { FirebaseMessagingPlugin } from "@capacitor-firebase/messaging";
import { api } from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getAccessToken } from "@/lib/api/client";

const INSTALLATION_KEY = "speakai.android-push-installation";
const OWNER_KEY = "speakai.android-push-owner";
export const FirebaseMessaging =
  registerPlugin<FirebaseMessagingPlugin>("FirebaseMessaging");
let pending: Promise<unknown> = Promise.resolve();

function inOrder<T>(action: () => Promise<T>): Promise<T> {
  const next = pending.then(action, action);
  pending = next.catch(() => undefined);
  return next;
}

export function isAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function installationId() {
  let value = localStorage.getItem(INSTALLATION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(INSTALLATION_KEY, value);
  }
  return value;
}

export function enableAndroidPush() {
  return inOrder(enableAndroidPushNow);
}

async function enableAndroidPushNow() {
  if (!isAndroidApp()) return;
  const owner = getAuthenticatedUserId();
  if (!owner) throw new Error("로그인 후 알림을 연결해 주세요.");
  const previous = localStorage.getItem(OWNER_KEY);
  if (previous && previous !== owner) {
    await FirebaseMessaging.deleteToken();
    localStorage.removeItem(OWNER_KEY);
  }
  const permission = await FirebaseMessaging.requestPermissions();
  if (permission.receive !== "granted")
    throw new Error("기기 설정에서 알림 권한을 허용해 주세요.");
  await FirebaseMessaging.createChannel({
    id: "speakai_notifications",
    name: "SpeakAI 알림",
    description: "연습과 서비스 알림",
    importance: 3,
  });
  const { token } = await FirebaseMessaging.getToken();
  if (getAuthenticatedUserId() !== owner)
    throw new Error("로그인 상태가 변경됐어요.");
  await api.notifications.registerNativeFcmDevice({
    installationId: installationId(),
    token,
  });
  if (getAuthenticatedUserId() !== owner)
    throw new Error("로그인 상태가 변경됐어요.");
  localStorage.setItem(OWNER_KEY, owner);
}

export function refreshAndroidPush() {
  return inOrder(refreshAndroidPushNow);
}

async function refreshAndroidPushNow() {
  if (!isAndroidApp()) return;
  const owner = getAuthenticatedUserId();
  const previous = localStorage.getItem(OWNER_KEY);
  if (!owner || !previous) return;
  if (previous !== owner) {
    await FirebaseMessaging.deleteToken();
    localStorage.removeItem(OWNER_KEY);
    return;
  }
  const permission = await FirebaseMessaging.checkPermissions();
  if (getAuthenticatedUserId() !== owner) return;
  if (permission.receive !== "granted") {
    const id = localStorage.getItem(INSTALLATION_KEY);
    if (id) await api.notifications.unregisterNativeFcmDevice(id);
    return;
  }
  const actual = (await FirebaseMessaging.getToken()).token;
  if (getAuthenticatedUserId() !== owner) return;
  await api.notifications.registerNativeFcmDevice({
    installationId: installationId(),
    token: actual,
  });
}

export function unregisterAndroidPush() {
  return inOrder(unregisterAndroidPushNow);
}

async function unregisterAndroidPushNow() {
  if (!isAndroidApp()) return;
  if (localStorage.getItem(OWNER_KEY) !== getAuthenticatedUserId()) return;
  const id = localStorage.getItem(INSTALLATION_KEY);
  if (id) await api.notifications.unregisterNativeFcmDevice(id);
  await FirebaseMessaging.deleteToken();
  localStorage.removeItem(OWNER_KEY);
}

export function reconcileAndroidPushSession() {
  return inOrder(async () => {
    if (!isAndroidApp()) return;
    const previous = localStorage.getItem(OWNER_KEY);
    if (!previous) return;
    const owner = getAuthenticatedUserId();
    if ((!owner && !getAccessToken()) || (owner && owner !== previous)) {
      await FirebaseMessaging.deleteToken();
      localStorage.removeItem(OWNER_KEY);
      return;
    }
    await refreshAndroidPushNow();
  });
}
