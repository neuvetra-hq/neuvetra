import { rename } from "node:fs/promises"
await rename(new URL("../dist-staging/staging.html", import.meta.url), new URL("../dist-staging/index.html", import.meta.url))
