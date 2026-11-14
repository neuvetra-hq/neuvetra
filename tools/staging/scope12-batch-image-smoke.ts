/**
 * BI-01b (QA follow-up 3 of PR #68): credential-free check, run inside the staging image, that Scope 1 and 2 results can
 * calculate. It builds the engines exactly as the staged server does (reviewedResultsEngines) and makes one real
 * calculate_many call per scope through scope12_batch.py. A missing or mis-pinned batch entry point (or engine, or data
 * file) fails this check, and the image job with it, instead of every /results answering 503 after a deploy.
 */
import { checkResultsEngines, reviewedResultsEngines } from '../../apps/site-api/src/workspace/collection-results-routes'

const result = await checkResultsEngines(reviewedResultsEngines())
console.log(JSON.stringify({ scope12BatchImageCheck: result.scope1 === 'ok' && result.scope2 === 'ok' ? 'passed' : 'failed', ...result }))
if (result.scope1 !== 'ok' || result.scope2 !== 'ok') process.exit(1)
