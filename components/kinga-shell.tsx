import Link from "next/link";
import { logoutAction } from "@/lib/honoa/server/actions";
import { homePathForUser, type AuthUser } from "@/lib/honoa/server/auth";
import { DEPARTMENT_LABELS, ROLE_LABELS } from "@/lib/honoa/shared/constants";

export function KingaShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div>
          <Link className="brand" href={homePathForUser(user)}>
            KingaOS
          </Link>
          <span className="muted">坤江内部业务操作系统</span>
        </div>
        <div className="userbox">
          <span>{user.name}</span>
          <span className="tag">{DEPARTMENT_LABELS[user.department]}</span>
          <span className="tag">{ROLE_LABELS[user.role]}</span>
          <form action={logoutAction}>
            <button className="ghost" type="submit">退出登录</button>
          </form>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}

export function LoadingShell() {
  return <main className="wrap">加载中...</main>;
}

export function DisabledCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="card disabled">
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="tag warn">暂未开放</span>
    </div>
  );
}

export function Forbidden({ message }: { message: string }) {
  return (
    <div className="panel stack">
      <h1>没有权限</h1>
      <p className="muted">{message}</p>
    </div>
  );
}
