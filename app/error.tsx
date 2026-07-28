"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("知途页面渲染失败", error);
  }, [error]);

  return (
    <main className="runtime-error-page">
      <section className="runtime-error-card">
        <span className="runtime-error-mark">知</span>
        <h1>页面恢复时遇到问题</h1>
        <p>
          你的账号和云端简历仍然安全。请点击下方按钮重新加载；若问题持续，
          页面会保留错误信息供我们继续定位。
        </p>
        <button onClick={reset}>重新加载工作台</button>
        <details>
          <summary>查看错误信息</summary>
          <code>{error.message || "未知页面错误"}</code>
        </details>
      </section>
    </main>
  );
}
