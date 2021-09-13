import { FileVersion } from "@prisma/client"
import { getBucket } from "../bucket"

export async function requestFileDownload(
  key: FileVersion["key"]
): Promise<string> {
  const bucket = getBucket()
  return await bucket.getSignedUrl("get", key)
}
