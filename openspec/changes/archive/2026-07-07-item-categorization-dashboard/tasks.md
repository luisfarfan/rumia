## 1. Database & Schema Updates

- [x] 1.1 Add `category` (VARCHAR) and `tags` (JSONB) columns to `captured_items` table in `schema.sql`
- [x] 1.2 Update the `CapturedItemsRepo` class to support reading and updating `category` and `tags`

## 2. Categorization Agent

- [x] 2.1 Define Zod schemas for Category and Tags extraction
- [x] 2.2 Create `src/agents/categorizationAgent.ts` using `generateStructured` via `LLMFactory`

## 3. Worker Integration (Resilient & Conditional)

- [x] 3.1 Import `runCategorizationAgent` and `runFactCheckerAgent` into `src/workers/ingestion/worker.ts`
- [x] 3.2 Create a utility function to truncate text context to a safe limit (e.g. 8000 characters) before passing to LLMs
- [x] 3.3 Update worker branches to call Categorization wrapped in a `try/catch` (fallback to `Unknown` category on failure)
- [x] 3.4 Implement conditional logic to ONLY call `FactCheckerAgent` if the assigned category is eligible (e.g. News, Opinion, Tutorial)
- [x] 3.5 Wrap `FactCheckerAgent` in a `try/catch` to ensure pipeline resilience

## 4. Next.js API & UI

- [x] 4.1 Update `frontend/src/app/api/items/route.ts` to execute a SQL `LEFT JOIN` or subquery to attach `claim_verifications` to each item
- [x] 4.2 Update `CapturedItem` interface in `page.tsx` to include `category`, `tags`, and `verifications`
- [x] 4.3 Add interactive Category Filter buttons to the dashboard header in `page.tsx`
- [x] 4.4 Update the Items Grid in `page.tsx` to display category badges and tag pills
- [x] 4.5 Add a "Reliability & Fact-Checking" section to the right-side Details panel in `page.tsx` showing the claims and their True/False/Inconclusive badges
