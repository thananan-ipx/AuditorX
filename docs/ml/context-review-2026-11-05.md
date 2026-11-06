# Context review — 2026-11-05

Owner-confirmed context: HRX and AllBallStarPython are experimental projects with
test data. The 28 previously pending findings now record repository criticality
`low` and exposure `test_only`. This records intended use; internet reachability
and deployed-source parity have not been verified. Test-only does not itself
prove that authorization or validation is correct.

## AllBallStarPython

Read-only Supabase inspection used the project matching the public endpoint in
the local app configuration. No business rows or credentials were queried, and
no remote schema or data was changed.

- `products`, `farms`, and `product_morphs` have RLS enabled. Product updates use
  ownership predicates based on auth.uid() and user_id.
- `products.status` is text, with no enum or CHECK constraint. The only product
  trigger found runs handle_updated_at(), whose body only sets updated_at.
  Combined with product.actions.ts:63 accepting an arbitrary string, this
  confirms a missing status allowlist at both inspected layers. Ownership checks
  limit the operation to the caller's products. Suggested human review: Low
  priority for this test-data project; do not label as an arbitrary-user update.
- `image_urls` is text[]. The action accepts existing image URLs from the caller,
  but Next image remotePatterns restricts HTTPS URLs to this project's public
  storage paths. Arbitrary-host image loading is not established. Whether images
  must be a subset of the product's existing images remains a business-rule
  question.
- The callback's slash/non-double-slash check accepts slash-backslash input.
  An isolated URL-parser check changed the resulting origin to example.invalid.
  Successful code-exchange callback navigation was not tested. The route-access
  advisory at callback:10 describes the same area as redirect:19; avoid counting
  them as independent examples of the same underlying defect.
- Login has the same path-check pattern. The proxy guards /farm but does not
  add validation to the login action's next parameter. Actual Next navigation
  behavior remains to be verified before asserting an end-to-end exploit.

## HRX

The connected Supabase account lists AllBallStarPython but not the HRX project.
HRX database policies, grants, triggers and constraints therefore remain
unverified. The HRX source tree contains no SQL policy snapshot.

- employee.action.ts:39 calls the service-role Auth admin createUser operation
  before checking the caller's identity/permission. UI form validation and a
  dashboard layout do not supply an action-level authorization check. Database
  row policies do not settle authorization for this Auth admin call. This is a
  source-confirmed missing guard; configured credentials, action reachability,
  runtime behavior and owner-approved urgency still require confirmation.
- leave-request.action.ts:171 checks employee identity but does not visibly check
  manager department ownership or the HR-final permission before updating by ID.
  Whether the update is rejected by RLS/trigger cannot be decided from the
  available source.
- submitLeaveRequest spreads caller payload after server-set employee_id/status;
  cancelLeaveRequestAction uses caller-supplied currentStatus. Their database
  enforcement remains unverified.
- Other pending read/update/delete actions depend on the absent policy snapshot
  or on unvalidated runtime parameters. They retain needs_context.

## Dataset disposition

Context updates are evidence revisions, not human ground-truth Priority labels.
Existing statuses remain 23 needs_context for HRX and 5 for AllBallStarPython.
No accepted Priority label was created automatically. A reviewer can now assess
the concrete status-validation case without guessing its schema or usage context.

Reference: https://supabase.com/docs/guides/database/postgres/row-level-security
