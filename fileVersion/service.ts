import { File, FileVersion, Prisma, PrismaClient } from "@prisma/client"
import { Pagination } from "../app"
import { getBucket } from "../bucket"
import { generateId } from "../util/generators"

const fileVersionInputFields = Prisma.validator<Prisma.FileVersionArgs>()({
  select: { fileId: true, name: true, mimeType: true, size: true },
})

export type CreateFileVersionInput = Prisma.FileVersionGetPayload<
  typeof fileVersionInputFields
>

export async function requestFileDownload(
  key: FileVersion["key"]
): Promise<string> {
  const bucket = getBucket()
  return await bucket.getSignedUrl("get", key)
}

export async function createFileVersionRecord(
  client: PrismaClient,
  fileVersion: CreateFileVersionInput
): Promise<FileVersion & { url: string }> {
  const file = await client.file.findUnique({
    where: { id: fileVersion.fileId },
  })

  if (!file) {
    throw new Error("File does not exist")
  }

  const key = await generateId()
  const version = await client.fileVersion.create({
    data: {
      ...fileVersion,
      key,
    },
    include: { file: true },
  })
  const bucket = getBucket()
  if (bucket) {
    const url = await bucket.getSignedUrl("put", key)
    return {
      ...version,
      url,
    }
  } else {
    await client.fileVersion.delete({ where: { id: version.id } })
    throw new Error("Could not instantiate file bucket")
  }
}

export async function getFileVersion(
  client: PrismaClient,
  id: FileVersion["id"]
): Promise<FileVersion | null> {
  return await client.fileVersion.findUnique({ where: { id } })
}

export async function getFileVersions(
  client: PrismaClient,
  fileId: File["id"],
  pagination?: Pagination
): Promise<FileVersion[]> {
  return await client.fileVersion.findMany({
    ...(pagination
      ? {
          skip: (pagination.page - 1) * pagination.pageLength,
          take: pagination.pageLength,
        }
      : {}),
    where: { fileId },
  })
}
