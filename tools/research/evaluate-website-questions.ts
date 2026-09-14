/** Explicit question-only local transport. Expected answers and reference pages
 * belong to independent QA and are never inputs to this runner or the service. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EvaluationError, evaluateWebsiteComposed, prepareQuestionOnlyEvaluation, sha256, type RuntimeBinding } from './evaluate-website-composed'

export { prepareQuestionOnlyEvaluation, evaluateWebsiteComposed }

if (import.meta.main) {
  try {
    const args = process.argv.slice(2), allowed = new Set(['--fixture', '--fixture-sha256', '--case-ids', '--output', '--runtime-binding', '--runtime-binding-sha256'])
    const values = new Map<string, string>()
    if (args.length !== 12) throw new EvaluationError('invalid_arguments')
    for (let i = 0; i < args.length; i += 2) {
      if (!allowed.has(args[i]!) || values.has(args[i]!) || !args[i + 1]) throw new EvaluationError('invalid_arguments')
      values.set(args[i]!, args[i + 1]!)
    }
    const bindingBytes = readFileSync(values.get('--runtime-binding')!)
    if (sha256(bindingBytes) !== values.get('--runtime-binding-sha256')) throw new EvaluationError('binding_pin_mismatch')
    const runtimeBinding = JSON.parse(bindingBytes.toString()) as RuntimeBinding
    if (Object.keys(runtimeBinding).sort().join(',') !== 'manifest_sha256,port,process_id,profile_sha256,run_id'
      || !/^[a-f0-9]{64}$/.test(runtimeBinding.manifest_sha256) || !/^[a-f0-9]{64}$/.test(runtimeBinding.profile_sha256)
      || !/^[a-z0-9-]{1,100}$/.test(runtimeBinding.run_id) || !Number.isInteger(runtimeBinding.process_id)
      || runtimeBinding.process_id <= 0 || runtimeBinding.port !== 3016) throw new EvaluationError('invalid_runtime_binding')
    const prepared = prepareQuestionOnlyEvaluation({ fixtureBytes: readFileSync(values.get('--fixture')!),
      fixtureSha256: values.get('--fixture-sha256')!, caseIds: values.get('--case-ids')!.split(','), repoRoot: process.cwd() })
    const result = await evaluateWebsiteComposed({ prepared, runtimeBinding, outputPath: path.resolve(values.get('--output')!) })
    console.log(JSON.stringify({ state: result.state, stop_reason: result.stop_reason, recorded_cases: result.cases.length, semantic_review: result.semantic_review }))
    if (result.state === 'stopped') process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({ error: error instanceof EvaluationError ? error.code : 'question_evaluation_failed' }))
    process.exitCode = 1
  }
}
