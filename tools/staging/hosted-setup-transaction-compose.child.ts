/** One-shot process entry point for local-only transaction composition tests. */
import { runHostedSetupLocalComposition, type HostedSetupComposeInput } from "./hosted-setup-transaction-compose"

const inputPath = process.argv[2]
if (!inputPath) throw new Error("LOCAL_COMPOSE_INPUT_REQUIRED")
const input = await Bun.file(inputPath).json() as HostedSetupComposeInput
console.log(JSON.stringify(await runHostedSetupLocalComposition(input)))
