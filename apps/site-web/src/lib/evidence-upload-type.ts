/**
 * The media type to declare when uploading an evidence file. Browsers take `File.type` from the computer, so a Windows
 * computer with Excel installed can report a `.csv` file as `application/vnd.ms-excel`, and some computers report no
 * type at all. When the reported type is empty or a known alias for the file's extension, declare the type that
 * extension stands for; otherwise keep what the browser reported and let the server decide. A different explicit type
 * is never replaced (a `.csv` reported as `image/png` stays `image/png`). The server still checks the file's bytes.
 */
const UNKNOWN = ["", "application/octet-stream"]
const BY_EXTENSION = new Map<string, { type: string; aliases: readonly string[] }>([
  ["csv", { type: "text/csv", aliases: [...UNKNOWN, "application/vnd.ms-excel", "text/plain", "application/csv", "text/x-csv", "text/comma-separated-values", "application/x-csv"] }],
  ["xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", aliases: UNKNOWN }],
  ["pdf", { type: "application/pdf", aliases: UNKNOWN }],
  ["png", { type: "image/png", aliases: UNKNOWN }],
  ["jpg", { type: "image/jpeg", aliases: UNKNOWN }],
  ["jpeg", { type: "image/jpeg", aliases: UNKNOWN }],
])

export function evidenceUploadType(fileName: string, reportedType: string): string {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? ""
  const known = BY_EXTENSION.get(extension)
  return known && known.aliases.includes(reportedType.trim().toLowerCase()) ? known.type : reportedType
}
