# AuditorX MVP Handover for Codex

## Product Context

AuditorX is an MVP GitHub App + Next.js landing page.

Temporary product name: **AuditorX**  
Positioning: **AI-powered technical debt auditor for vibe coding teams**

AuditorX reviews Pull Requests and detects AI-generated code risks before they are merged.

Core idea:

> AI helps developers ship faster, but it also creates hidden technical debt. AuditorX reviews PR diffs and comments on code smells, architecture risks, maintainability risks, and security/performance concerns.

This is not a SonarQube clone. The MVP should focus on PR-level AI review, not full repository scanning.

---

## MVP Goal

Build a working MVP with:

1. Next.js landing page
2. GitHub App webhook endpoint
3. Pull Request diff analysis
4. AI-generated code review summary
5. Automatic PR comment
6. Basic Supabase persistence
7. Minimal admin/debug page

---

## Non-Goals for MVP

Do **not** build these yet:

- Full repository scan
- Complex dashboard
- Billing/subscription
- Team management
- PDF reports
- Multi-language static analyzer engine
- Custom rule builder
- Enterprise SSO
- Slack/Jira integrations
- Full SonarQube-style metrics

Keep the MVP small and shippable.

---

## Recommended Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel
- GitHub App
- OpenAI API or Claude API
- Octokit for GitHub API
- Zod for validation

Optional UI libraries:

- shadcn/ui
- lucide-react

---

## Main User Flow

```text
Visitor opens landing page
↓
Clicks "Install GitHub App"
↓
Installs AuditorX on selected repository
↓
Developer opens Pull Request
↓
GitHub sends webhook to /api/github/webhook
↓
AuditorX verifies webhook signature
↓
AuditorX fetches PR changed files / patch diff
↓
AuditorX sends diff to AI reviewer
↓
AI returns structured review
↓
AuditorX posts PR comment
↓
AuditorX stores review metadata in Supabase
```

---

## GitHub App MVP Behavior

Listen to these Pull Request actions only:

- `opened`
- `synchronize`
- `reopened`

For each event:

1. Verify GitHub webhook signature.
2. Extract:
   - installation id
   - repository owner
   - repository name
   - pull request number
   - pull request title
   - pull request URL
3. Get installation access token.
4. Fetch PR changed files.
5. Extract patch/diff content.
6. Limit total diff size to avoid excessive AI cost.
7. Send to AI review service.
8. Post one summary comment on the PR.
9. Save review record in database.

---

## Review Categories

The AI reviewer should detect:

### 1. AI Code Smell

Examples:

- Overly generic service/helper names
- Duplicate logic across files
- Over-engineered abstractions
- Unclear responsibility boundaries
- Large generated components/functions

### 2. Architecture Risk

Examples:

- God service
- God component
- Mixed concerns
- Circular dependency risk
- Business logic inside UI layer
- Data access logic scattered everywhere

### 3. Maintainability Risk

Examples:

- Very long files
- Very long functions
- Repeated condition blocks
- Poor naming
- Hard-to-test logic
- Excessive nesting

### 4. Security Risk

Examples:

- Unsafe HTML rendering
- Direct string interpolation in queries
- Hardcoded secrets
- Missing authorization checks
- Insecure dynamic input usage

### 5. Performance Risk

Examples:

- N+1 query patterns
- Sequential await inside loops
- Expensive client-side operations
- Unnecessary re-renders
- Large payload handling without pagination

---

## AI Output Format

The AI should return JSON only.

Expected schema:

```json
{
  "score": 72,
  "riskLevel": "medium",
  "summary": "This PR is mostly safe but introduces maintainability risks in the user service layer.",
  "findings": [
    {
      "severity": "high",
      "category": "architecture",
      "title": "UserService has too many responsibilities",
      "description": "The service handles validation, database access, notification, and response transformation in one place.",
      "recommendation": "Split this into UserValidationService, UserRepository, and UserNotificationService.",
      "file": "src/services/user.service.ts"
    }
  ],
  "positiveNotes": [
    "The PR keeps API response types explicit.",
    "The new tests cover the main success path."
  ]
}
```

Valid values:

```ts
type RiskLevel = "low" | "medium" | "high" | "critical";
type Severity = "info" | "low" | "medium" | "high" | "critical";
type Category =
  | "ai-smell"
  | "architecture"
  | "maintainability"
  | "security"
  | "performance"
  | "testing";
```

---

## PR Comment Format

Post a single markdown comment like this:

```md
## AuditorX Review

**AI Smell Score:** 72/100  
**Risk Level:** Medium

This PR is mostly safe but introduces maintainability risks in the user service layer.

### Findings

#### 1. High · Architecture · UserService has too many responsibilities

File: `src/services/user.service.ts`

The service handles validation, database access, notification, and response transformation in one place.

Recommendation:
Split this into UserValidationService, UserRepository, and UserNotificationService.

### Positive Notes

- The PR keeps API response types explicit.
- The new tests cover the main success path.

---

AuditorX is an AI-powered technical debt auditor for vibe coding teams.
```

MVP can post a new comment every time.  
Later version can update an existing bot comment instead.

---

## Landing Page Requirements

Create a simple landing page with these sections:

### Hero

Title:

> Find hidden technical debt in AI-written code.

Subtitle:

> AuditorX reviews every pull request and catches code smells, architecture risks, and maintainability issues before they reach production.

CTA buttons:

- Install GitHub App
- Join Early Access

### Problem

Explain that AI coding tools generate working code quickly, but hidden risks accumulate:

- duplicated business logic
- god components
- god services
- unsafe patterns
- N+1 queries
- unclear architecture

### How It Works

1. Install AuditorX GitHub App
2. Open a pull request
3. AuditorX reviews the diff
4. Get an AI audit comment before merge

### Example Review

Show a fake PR comment card.

### Pricing Placeholder

Use early access pricing:

- Free trial for early teams
- Early Access: 3,900 THB / repo / month
- Custom audit service by IPX

### CTA

> Start auditing your AI-generated code before it becomes technical debt.

---

## Suggested File Structure

```text
src/
  app/
    page.tsx
    layout.tsx
    api/
      github/
        webhook/
          route.ts
      waitlist/
        route.ts
    admin/
      reviews/
        page.tsx

  components/
    landing/
      HeroSection.tsx
      ProblemSection.tsx
      HowItWorksSection.tsx
      ExampleReviewSection.tsx
      PricingSection.tsx
      CTASection.tsx

  lib/
    github/
      app.ts
      verify-webhook.ts
      pr-files.ts
      comment.ts

    ai/
      reviewer.ts
      prompts.ts
      schema.ts

    supabase/
      client.ts
      server.ts

    utils/
      truncate-diff.ts
      format-review-comment.ts

  types/
    github.ts
    review.ts
```

---

## Environment Variables

```env
NEXT_PUBLIC_APP_URL=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

OPENAI_API_KEY=
# or
ANTHROPIC_API_KEY=
```

Important:

- Never expose service role key to client.
- Never expose GitHub private key to client.
- Webhook endpoint must verify signature before processing.

---

## Supabase Tables

### installations

```sql
create table installations (
  id uuid primary key default gen_random_uuid(),
  github_installation_id bigint not null unique,
  account_login text,
  account_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### repositories

```sql
create table repositories (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid references installations(id),
  github_repo_id bigint not null unique,
  owner text not null,
  name text not null,
  full_name text not null,
  private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### pull_requests

```sql
create table pull_requests (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references repositories(id),
  github_pr_id bigint not null,
  number int not null,
  title text,
  url text,
  state text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(repository_id, number)
);
```

### reviews

```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  pull_request_id uuid references pull_requests(id),
  score int,
  risk_level text,
  summary text,
  findings jsonb,
  positive_notes jsonb,
  raw_ai_response jsonb,
  github_comment_id bigint,
  created_at timestamptz default now()
);
```

### waitlist

```sql
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  github_org text,
  created_at timestamptz default now()
);
```

---

## AI Reviewer Prompt

Use this as the system prompt for the AI reviewer:

```text
You are AuditorX, an AI technical debt auditor for modern software teams using AI coding tools.

Your job is to review Pull Request diffs and detect hidden code risks that normal linters may miss.

Focus on:
- AI-generated code smells
- architecture risks
- maintainability risks
- security risks
- performance risks
- missing or weak tests

Do not nitpick formatting.
Do not comment on style issues that ESLint or Prettier should handle.
Do not invent files or code that are not present in the diff.
Be practical, specific, and concise.

Score meaning:
- 90-100: very safe
- 75-89: low risk
- 50-74: medium risk
- 25-49: high risk
- 0-24: critical risk

Return JSON only with this shape:
{
  "score": number,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "summary": string,
  "findings": [
    {
      "severity": "info" | "low" | "medium" | "high" | "critical",
      "category": "ai-smell" | "architecture" | "maintainability" | "security" | "performance" | "testing",
      "title": string,
      "description": string,
      "recommendation": string,
      "file": string | null
    }
  ],
  "positiveNotes": string[]
}
```

User prompt template:

```text
Review this Pull Request.

Repository: {{repoFullName}}
Pull Request: #{{pullNumber}} - {{pullTitle}}

Changed files and patches:

{{diffContent}}

Return JSON only.
```

---

## Diff Truncation Rules

To control AI cost:

- Analyze only text/code files.
- Ignore binary files.
- Ignore lock files:
  - package-lock.json
  - yarn.lock
  - pnpm-lock.yaml
- Ignore generated files:
  - dist/
  - build/
  - .next/
  - coverage/
- Max files per review: 20
- Max total characters sent to AI: 50,000
- If diff is too large, include a warning in the PR comment:
  - "Large PR detected. AuditorX reviewed a limited subset of changed files."

---

## Implementation Tasks for Codex

### Task 1: Bootstrap project

Create a Next.js App Router project with TypeScript and Tailwind CSS.

Acceptance criteria:

- `npm run dev` works.
- Landing page renders.
- Basic layout exists.
- Environment variable validation is implemented.

---

### Task 2: Build landing page

Implement landing page sections:

- Hero
- Problem
- How It Works
- Example Review
- Pricing
- CTA
- Waitlist form

Acceptance criteria:

- Fully responsive.
- CTA button links to GitHub App installation URL placeholder.
- Waitlist form stores data in Supabase.

---

### Task 3: Supabase integration

Create Supabase client helpers and SQL migration files.

Acceptance criteria:

- Tables are documented.
- Waitlist insert works.
- Review insert works.
- Service role is only used server-side.

---

### Task 4: GitHub webhook endpoint

Create:

```text
POST /api/github/webhook
```

Acceptance criteria:

- Verifies GitHub signature.
- Handles pull_request events.
- Ignores unsupported events/actions.
- Returns 200 quickly for ignored events.
- Logs useful debug information.

---

### Task 5: GitHub App auth

Implement installation token generation.

Acceptance criteria:

- Uses GitHub App ID and private key.
- Can call GitHub API as installation.
- Can fetch PR files.

---

### Task 6: PR diff extraction

Fetch changed files from Pull Request and build diff content.

Acceptance criteria:

- Includes filename, status, additions, deletions, and patch.
- Ignores binary/lock/generated files.
- Applies max file and max character limits.
- Returns whether truncation happened.

---

### Task 7: AI review service

Implement AI reviewer using OpenAI or Claude.

Acceptance criteria:

- Sends diff to AI.
- Receives JSON.
- Validates response with Zod.
- Handles invalid JSON gracefully.
- Returns fallback review if AI fails.

---

### Task 8: PR comment formatter

Convert review JSON into markdown comment.

Acceptance criteria:

- Includes score, risk level, summary, findings, positive notes.
- Includes truncation warning when needed.
- Uses clean markdown.
- Avoids excessive length.

---

### Task 9: Post GitHub PR comment

Post review as issue comment on Pull Request.

Acceptance criteria:

- Comment is posted successfully.
- Comment includes AuditorX branding.
- Stores GitHub comment ID in Supabase.

---

### Task 10: Admin/debug review page

Create simple admin page:

```text
/admin/reviews
```

Acceptance criteria:

- Shows recent reviews.
- Shows repo name, PR number, score, risk level, created date.
- No auth required for MVP if local only, but add TODO for auth before production.

---

## Suggested API Route Pseudocode

```ts
export async function POST(req: Request) {
  const rawBody = await req.text();

  verifyGitHubSignature({
    rawBody,
    signature: req.headers.get("x-hub-signature-256"),
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  });

  const event = req.headers.get("x-github-event");
  const payload = JSON.parse(rawBody);

  if (event !== "pull_request") {
    return Response.json({ ok: true, ignored: true });
  }

  const action = payload.action;
  if (!["opened", "synchronize", "reopened"].includes(action)) {
    return Response.json({ ok: true, ignored: true });
  }

  const installationId = payload.installation.id;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pullNumber = payload.pull_request.number;

  const token = await getInstallationToken(installationId);

  const files = await getPullRequestFiles({
    token,
    owner,
    repo,
    pullNumber,
  });

  const diff = buildDiffContent(files);

  const review = await reviewPullRequestWithAI({
    repoFullName: payload.repository.full_name,
    pullNumber,
    pullTitle: payload.pull_request.title,
    diffContent: diff.content,
  });

  const comment = formatReviewComment(review, {
    truncated: diff.truncated,
  });

  const githubComment = await postPullRequestComment({
    token,
    owner,
    repo,
    pullNumber,
    body: comment,
  });

  await saveReviewToSupabase({
    payload,
    review,
    githubCommentId: githubComment.id,
  });

  return Response.json({ ok: true });
}
```

---

## Security Requirements

- Verify GitHub webhook signature.
- Do not log raw source code in production.
- Do not store full diff in database for MVP.
- Store only review summary/findings.
- Never expose GitHub private key to browser.
- Never expose Supabase service role key to browser.
- Add rate limiting later.
- Add repo allowlist for early access if needed.

---

## Product Copy

Use this wording on landing page:

### Hero

```text
Find hidden technical debt in AI-written code.
```

### Subtitle

```text
AuditorX reviews every pull request and catches code smells, architecture risks, and maintainability issues before they reach production.
```

### Problem

```text
AI coding tools help teams ship faster, but they also create invisible technical debt: duplicated logic, oversized components, scattered business rules, and risky architecture decisions.
```

### CTA

```text
Start auditing your AI-generated code before it becomes technical debt.
```

---

## MVP Success Criteria

The MVP is successful when:

- A user can install the GitHub App.
- AuditorX receives PR webhook events.
- AuditorX reviews a PR diff.
- AuditorX posts a meaningful comment on the PR.
- Landing page explains the product clearly.
- Waitlist form captures leads.
- At least 5 repositories can be tested manually.

---

## Future Roadmap

After MVP:

1. Update existing bot comment instead of creating new comments.
2. Add organization dashboard.
3. Add repository health score.
4. Add historical technical debt trend.
5. Add billing.
6. Add Slack notifications.
7. Add Jira ticket generation.
8. Add full repository scan.
9. Add custom team rules.
10. Add severity thresholds to block merge.
