import Link from "next/link";
import { Forbidden, KingaShell } from "@/components/kinga-shell";
import { requireCurrentUser } from "@/lib/honoa/server/auth";
import {
  isReleaseNoteCategory,
  RELEASE_CATEGORY_FILTERS,
  RELEASE_CATEGORY_LABELS,
  RELEASE_NOTES,
  type ReleaseNote,
  type ReleaseNoteCategory
} from "@/lib/honoa/shared/release-notes";

const MIGRATION_LABELS: Record<ReleaseNote["migration"], string> = {
  none: "无 migration",
  additive: "Additive migration",
  destructive: "Destructive migration"
};

const DATA_RISK_LABELS: Record<ReleaseNote["productionDataRisk"], string> = {
  none: "无生产数据风险",
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

const DATA_COMMAND_LABELS: Record<ReleaseNote["productionDataCommand"], string> = {
  none: "未运行生产数据命令",
  migration: "运行生产 migration",
  seed: "运行 seed",
  "manual-data-script": "运行人工数据脚本",
  other: "其他生产数据命令"
};

function categoryClass(category: ReleaseNoteCategory) {
  if (category === "fix") return "tag warn";
  if (category === "security" || category === "data") return "tag danger";
  if (category === "ui" || category === "docs") return "tag";
  return "tag ok";
}

function riskClass(risk: ReleaseNote["productionDataRisk"]) {
  if (risk === "none") return "tag ok";
  if (risk === "low") return "tag";
  if (risk === "medium") return "tag warn";
  return "tag danger";
}

function migrationClass(migration: ReleaseNote["migration"]) {
  if (migration === "none") return "tag ok";
  if (migration === "additive") return "tag warn";
  return "tag danger";
}

export default async function AdminChangelogPage({
  searchParams
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const user = await requireCurrentUser();
  if (user.role !== "super_admin" && user.role !== "admin") {
    return (
      <KingaShell user={user}>
        <Forbidden message="当前账号不能查看管理员版本更新日志。" />
      </KingaShell>
    );
  }

  const params = await searchParams;
  const selectedCategory = params?.category && isReleaseNoteCategory(params.category) ? params.category : "all";
  const notes = selectedCategory === "all" ? RELEASE_NOTES : RELEASE_NOTES.filter((note) => note.category === selectedCategory);

  return (
    <KingaShell user={user}>
      <div className="stack">
        <section className="page-hero">
          <div>
            <div className="breadcrumbs">KingaOS / Admin / 版本更新日志</div>
            <h1>版本更新日志</h1>
            <p className="muted">记录 KingaOS 每次功能更新、修复、安全调整和数据结构变化。</p>
          </div>
          <span className="tag ok">只读</span>
        </section>

        <nav className="filter-pills" aria-label="版本更新类型筛选">
          {RELEASE_CATEGORY_FILTERS.map((item) => {
            const href = item.key === "all" ? "/admin/changelog" : `/admin/changelog?category=${item.key}`;
            const active = selectedCategory === item.key;
            return (
              <Link className={active ? "filter-pill active" : "filter-pill"} href={href} key={item.key}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <section className="release-timeline" data-testid="release-note-list">
          {notes.map((note) => (
            <article className="release-card" key={note.id}>
              <div className="release-card-marker" aria-hidden="true" />
              <div className="release-card-body">
                <div className="release-card-header">
                  <div>
                    <div className="inline-stack">
                      <span className="tag">{note.version}</span>
                      <span className={categoryClass(note.category)}>{RELEASE_CATEGORY_LABELS[note.category]}</span>
                    </div>
                    <h2>{note.title}</h2>
                  </div>
                  <time className="muted">{note.date}</time>
                </div>

                <div className="inline-stack">
                  <span className={migrationClass(note.migration)}>{MIGRATION_LABELS[note.migration]}</span>
                  <span className={note.productionDataCommand === "none" ? "tag ok" : "tag warn"}>{DATA_COMMAND_LABELS[note.productionDataCommand]}</span>
                  <span className={riskClass(note.productionDataRisk)}>{DATA_RISK_LABELS[note.productionDataRisk]}</span>
                  {note.commitHash ? <span className="tag">commit {note.commitHash}</span> : null}
                </div>

                <div>
                  <h3>影响范围</h3>
                  <p className="muted">{note.affectedAreas.join(" / ")}</p>
                </div>

                <ul className="release-summary">
                  {note.summary.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </section>
      </div>
    </KingaShell>
  );
}
