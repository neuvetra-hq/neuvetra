import { createClient } from "@supabase/supabase-js"
import type { CollectionEvidenceStorage } from "./collection-routes"

/**
 * Uses the caller's verified bearer token. Bucket creation and object-policy
 * installation remain an operator-controlled deployment prerequisite.
 */
export function createSupabaseCollectionEvidenceStorage(options: {
  url: string
  anonKey: string
  fetch?: typeof fetch
}): CollectionEvidenceStorage {
  const client = (token: string) => createClient(options.url, options.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { authorization: `Bearer ${token}` },
      ...(options.fetch ? { fetch: options.fetch } : {}),
    },
  })
  return {
    async put(token, bucket, objectKey, bytes, mediaType) {
      const { error } = await client(token).storage.from(bucket).upload(objectKey, bytes, { contentType: mediaType, upsert: false })
      if (error) throw new Error("Evidence storage upload failed.")
    },
    async get(token, bucket, objectKey) {
      const { data, error } = await client(token).storage.from(bucket).download(objectKey)
      if (error || !data) throw new Error("Evidence storage download failed.")
      return new Uint8Array(await data.arrayBuffer())
    },
  }
}
