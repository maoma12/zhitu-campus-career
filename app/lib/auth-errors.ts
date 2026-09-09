export type PasswordAuthMode = "login" | "register";

const NETWORK_ERROR_MARKERS = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
];

export function toPasswordAuthUserMessage(
  error: unknown,
  mode: PasswordAuthMode,
) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.trim().toLowerCase();

  if (
    normalized === "invalid login credentials" ||
    normalized.includes("invalid credentials")
  ) {
    return "邮箱或密码错误";
  }
  if (
    error instanceof TypeError ||
    NETWORK_ERROR_MARKERS.some((marker) => normalized.includes(marker))
  ) {
    return "暂时无法连接账号服务，尚未验证邮箱或密码。你仍可使用免登录体验。";
  }
  if (normalized.includes("already registered")) {
    return "该邮箱已注册，请切换到登录";
  }
  if (normalized.includes("password")) {
    return "密码不符合安全要求，请至少使用 8 位字符";
  }
  return mode === "login"
    ? "暂时无法完成登录，请稍后重试。你仍可使用免登录体验。"
    : "暂时无法完成注册，请稍后重试。你仍可使用免登录体验。";
}
