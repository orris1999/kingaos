# Domestic Phase 1 Contract

This document locks the route, permission, and opening contract for the domestic department Phase 1 work. It supersedes the old Task 001 plan named "Add domestic department entry and permissions".

## 1. Current status

- The domestic entry and `/domestic` route already exist.
- Task 001A has been completed: the unavailable domestic gate was hardened.
- Current module status is `DOMESTIC_MODULE_STATUS = "not_open"`.
- The domestic module still has no real business feature open.
- In the current `not_open` state, `/domestic` only allows `super_admin` to view the unavailable placeholder page.
- A normal domestic user cannot enter `/domestic` only because `department = domestic`.
- `/domestic/[...slug]` reuses the same gate by rendering the same domestic page.

## 2. Route contract

Future domestic routes must use the existing repository route family:

- `/domestic`
- `/domestic/customers`
- `/domestic/customers/[id]`
- `/domestic/reviews`
- `/domestic/policy-requests`

The old planning routes are deprecated and must not be reintroduced:

- `/department/domestic`
- `/department/domestic/customers`
- `/department/domestic/reviews`
- `/department/domestic/policy-requests`

Future prompts for Task 002 and later must continue to use `/domestic`; they must not introduce `/department/domestic`.

## 3. Permission contract

The current domestic permission key is:

- `domestic.dashboard.view`

Task 001A did not add any new permission key.

Do not add the following in Task 001B:

- `domestic.department.access`
- `domestic_salesperson`
- `domestic_manager`
- `domestic.customer.*`
- `domestic.sales_snapshot.*`
- `domestic.review.*`
- `domestic.policy_request.*`

Future permissions must be added gradually with the task that first needs them:

- Task 002/003 may consider `domestic.customer.*`.
- Task 005/006 may consider `domestic.sales_snapshot.*`.
- Task 007/008 may consider `domestic.review.*`.
- Task 009/010 may consider `domestic.policy_request.*`.

Every new permission must:

- Have server-side enforcement.
- Have tests.
- Avoid seed-created real business data.
- Use the existing permission management mechanism instead of bypassing it.

## 4. Opening gate contract

Moving the domestic module from `not_open` to `phase_1_open` requires all of the following:

- Domestic customer profile model and domain actions are complete.
- `CustomerIdentity` is reused.
- Duplicate customer review flow is clear.
- Server-side permission checks are complete.
- There is no formal `localStorage`, `sessionStorage`, or `IndexedDB` business data path.
- Export customer profiles are not affected.
- There is no manual sales amount entry.
- There is no quotation, order, or price list feature.
- `super_admin` / administrator approval confirms opening.

While the module is `not_open`, do not open:

- Domestic customer list.
- Customer creation.
- Sales data import.
- Quarterly review.
- Policy request.
- Quotation, order, or price list.

## 5. Domestic Phase 1 scope

Phase 1 is limited to:

- Domestic customer profiles.
- Real sales data snapshot / import.
- Customer quarterly review.
- Customer policy request pre-review.

Phase 1 does not include:

- Full CRM.
- Quotation.
- Order.
- Price list.
- ERP.
- Contract.
- Automatic region protection.
- Automatic customer elimination.
- Salesperson manual sales amount entry.

## 6. Task sequence after Task 001B

- Task 002: DomesticCustomerProfile model planning / implementation.
- Task 003: Domestic customer domain actions + duplicate review.
- Task 004: Domestic customer pages.
- Task 005: CustomerSalesSnapshot import models.
- Task 006: Excel import + matching workflow.
- Task 007: Quarterly review domain.
- Task 008: Quarterly review pages.
- Task 009: Policy request domain.
- Task 010: Policy request pages.
- Task 011: Rating and region planning docs.

Task 002 is the first task that may involve Prisma schema / migration work. Task 001B does not change the database.

## 7. Red lines

- Do not use `/department/domestic`.
- Do not use `localStorage`, `sessionStorage`, or `IndexedDB` as a formal business data path.
- Do not bypass `CustomerIdentity`.
- Do not let salespeople manually enter or edit sales amounts.
- Do not change export customer profiles.
- Do not change OSS, ECS, env, or deploy configuration.
- Do not write real business data in seed, migration, or deploy scripts.
- Do not turn the customer review Excel file directly into company policy.
- Do not build quotation, order, or price list features.
- Do not build a full CRM or ERP.
