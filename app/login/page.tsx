import { loginAction } from "@/lib/honoa/server/actions";
import { getCurrentUser, homePathForUser } from "@/lib/honoa/server/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForUser(user));
  return (
    <main className="login-wrap">
      <section className="panel stack">
        <div>
          <h1>KingaOS</h1>
          <p className="muted">请使用管理员分配的账号登录。</p>
        </div>
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
