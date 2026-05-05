import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
});

test("打开登录页", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "KingaOS" })).toBeVisible();
  await expect(page.getByLabel("邮箱")).toBeVisible();
});

test("super_admin 登录后进入 admin 首页并看到用户管理和出口部客户档案入口", async ({ page }) => {
  await login(page, "superadmin@kingaos.local", "roserose");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "系统管理入口" })).toBeVisible();
  await expect(page.getByRole("link", { name: /用户管理/ })).toBeVisible();
  await page.getByRole("link", { name: /出口部/ }).click();
  await expect(page.getByRole("link", { name: /客户档案/ })).toBeVisible();
});

test("super_admin 打开新建客户并看到多联系人与中文字段类型", async ({ page }) => {
  await login(page, "superadmin@kingaos.local", "roserose");
  await page.goto("/export/customers/new");
  await expect(page.getByRole("heading", { name: "新建客户" })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加联系人" })).toBeVisible();
  await page.goto("/export/customers/settings/fields");
  await expect(page.getByRole("heading", { name: "客户档案字段配置" })).toBeVisible();
  await expect(page.locator('select[name="fieldType"]').first()).toContainText("单行文本");
  await expect(page.locator('select[name="fieldType"]').first()).toContainText("是/否");
});

test("出口部业务员登录后看到出口部页面和暂未开放查询价格", async ({ page }) => {
  await login(page, "export.a@kingaos.local", "Kingaos@123456");
  await expect(page).toHaveURL(/\/export$/);
  await expect(page.getByRole("heading", { name: "出口部" })).toBeVisible();
  await expect(page.getByText("查询价格")).toBeVisible();
  await expect(page.getByText("暂未开放，未来由财务部价格域确认后开放")).toBeVisible();
});
