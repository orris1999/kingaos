import { loginAction } from "@/lib/honoa/server/actions";
import { getCurrentUser, homePathForUser } from "@/lib/honoa/server/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homePathForUser(user));
  const params = await searchParams;
  const hasLoginError = params?.error === "invalid";
  return (
    <main className="login-wrap">
      <section className="panel stack">
        <div>
          <h1>KingaOS</h1>
          <p className="muted">请使用管理员分配的账号登录。</p>
        </div>
        {hasLoginError ? <p className="error">邮箱或密码错误，或账号已停用。</p> : null}
        <form className="stack" action={loginAction}>
          <label>
            邮箱
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            密码
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">登录</button>
        </form>
      </section>
    </main>
  );
}
