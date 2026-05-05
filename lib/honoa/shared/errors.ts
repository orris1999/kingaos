export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class PermissionDeniedError extends DomainError {
  constructor(message = "当前账号没有访问该功能的权限。") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}
