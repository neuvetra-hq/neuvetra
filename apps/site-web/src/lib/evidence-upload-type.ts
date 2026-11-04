/**
 * The media type to declare when uploading an evidence file. Browsers take `File.type` from the computer, so a Windows
 * computer with Excel installed can report a `.csv` file as `application/vnd.ms-excel`, and some computers report no
 * type at all. When the reported type is empty or a known alias for the file's extension, declare the type that
 * extension stands for; otherwise keep what the browser reported and let the server decide. A different explicit type
 * is never replaced (a `.csv` reported as `image/png` stays `image/png`). The server still checks the file's bytes.
 * Parameters such as `; charset=utf-8` are ignored when the reported type is compared, as the server ignores them.
 */
const UNKNOWN = ["", "application/octet-stream"]
const BY_EXTENSION = new Map<string, { type: string; aliases: readonly string[] }>([
  ["csv", { type: "text/csv", aliases: [...UNKNOWN, "application/vnd.ms-excel", "text/plain", "application/csv", "text/x-csv", "text/comma-separated-values", "text/x-comma-separated-values", "application/x-csv"] }],
  ["xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", aliases: UNKNOWN }],
  ["pdf", { type: "application/pdf", aliases: UNKNOWN }],
  ["png", { type: "image/png", aliases: UNKNOWN }],
  ["jpg", { type: "image/jpeg", aliases: UNKNOWN }],
  ["jpeg", { type: "image/jpeg", aliases: UNKNOWN }],
])

const mediaType = (reportedType: string) => (reportedType.split(";", 1)[0] ?? "").trim().toLowerCase()

export function evidenceUploadType(fileName: string, reportedType: string): string {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? ""
  const known = BY_EXTENSION.get(extension)
  return known && known.aliases.includes(mediaType(reportedType)) ? known.type : reportedType
}

/**
 * The downloaded evidence-pack ZIP to send for replay, or null when the chosen file is not a ZIP. Windows browsers report
 * a `.zip` file as `application/x-zip-compressed`, and some computers report `application/x-zip`, a generic type or
 * none. A `.zip` file reported with one of those types is sent as `application/zip`; a file reported as
 * `application/zip` is sent unchanged. The type is only a label: the server replays the exact bytes against the stored
 * pack and refuses anything else.
 */
const ZIP_ALIASES = [...UNKNOWN, "application/x-zip-compressed", "application/x-zip"]

export function evidencePackZip(file: File): File | null {
  const reported = mediaType(file.type)
  if (reported === "application/zip") return file
  if (!/\.zip$/i.test(file.name) || !ZIP_ALIASES.includes(reported)) return null
  return new File([file], file.name, { type: "application/zip", lastModified: file.lastModified })
}
