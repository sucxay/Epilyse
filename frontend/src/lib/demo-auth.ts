export const demoUserKey = "epilyse-demo-user";
export const demoSessionKey = "epilyse-demo-session";

export interface DemoUser {
  fullName: string;
  email: string;
  password: string;
}

export function getDemoUser(): DemoUser | null {
  const rawUser = window.localStorage.getItem(demoUserKey);

  if (!rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as DemoUser;
    if (!user.fullName || !user.email || !user.password) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function hasDemoSession() {
  return window.localStorage.getItem(demoSessionKey) === "active";
}

export function saveDemoUser(user: DemoUser) {
  window.localStorage.setItem(demoUserKey, JSON.stringify(user));
  window.localStorage.setItem(demoSessionKey, "active");
}

export function startDemoSession() {
  window.localStorage.setItem(demoSessionKey, "active");
}

export function endDemoSession() {
  window.localStorage.removeItem(demoSessionKey);
}
