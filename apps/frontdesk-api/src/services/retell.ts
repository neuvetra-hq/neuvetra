import Retell from "retell-sdk"

export const retell = new Retell({ apiKey: Bun.env.RETELL_API_KEY ?? "" })
