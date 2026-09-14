import { X509Certificate } from "node:crypto"

const MAX_CA_BYTES = 65_536
/** A bounded certificate bundle only; never accepts keys, TLS options, or verification overrides. */
export function validateDatabaseCaPem(value: string): string {
  if (!value || Buffer.byteLength(value,"utf8") > MAX_CA_BYTES) throw new Error("Invalid staging database CA bundle.")
  const certificates = value.match(/-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----/g)
  if (!certificates?.length || certificates.length>10 || value.replace(/-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----/g,"").trim()) throw new Error("Invalid staging database CA bundle.")
  try {
    for(const certificate of certificates) if(!new X509Certificate(certificate).ca) throw new Error("CA certificate required.")
  } catch { throw new Error("Invalid staging database CA bundle.") }
  return certificates.join("\n")+"\n"
}

/** Operator/runtime explicitly select either a public CA file or a PEM setting. No automatic env loading. */
export async function loadStagingDatabaseCa(options: {caPem?:string;caFile?:string}): Promise<string|undefined> {
  if(options.caPem!==undefined && options.caFile!==undefined) throw new Error("Select one staging database CA source.")
  if(options.caPem!==undefined) return validateDatabaseCaPem(options.caPem)
  if(options.caFile!==undefined){
    if(!options.caFile || options.caFile.length>4096) throw new Error("Invalid staging database CA file.")
    try {
      const file=Bun.file(options.caFile)
      if(file.size>MAX_CA_BYTES) throw new Error("CA bundle exceeds bound.")
      return validateDatabaseCaPem(await file.text())
    } catch { throw new Error("Invalid staging database CA file.") }
  }
  return undefined
}
