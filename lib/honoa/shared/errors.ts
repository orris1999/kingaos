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

export class DuplicateCustomerNameError extends DomainError {
  constructor(
    message = "客户名称已存在，不能直接重复建档。",
    public readonly duplicateReviewRequestId?: string
  ) {
    super(message);
    this.name = "DuplicateCustomerNameError";
  }
}
