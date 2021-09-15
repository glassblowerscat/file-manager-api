import { File, FileVersion, Prisma, PrismaClient } from "@prisma/client"
import { getBucket } from "../bucket/bucket"
import { CreateFileVersionInput } from "../fileVersion"
import { generateId } from "../util/generators"

const fileInputFields = Prisma.validator<Prisma.FileArgs>()({
  select: { name: true, directoryId: true },
})

export type CreateFileInput = Prisma.FileGetPayload<typeof fileInputFields> &
  Omit<CreateFileVersionInput, "fileId" | "key"> & { key?: FileVersion["key"] }

export async function createFileRecord(
  client: PrismaClient,
  file: CreateFileInput
): Promise<{ file: File; url: string }> {
  const { name, directoryId, mimeType, size, key: keyInput } = file
  const key = keyInput ?? (await generateId())

  const directory = await client.directory.findUnique({
    where: { id: directoryId },
  })
  const ancestors = directory?.ancestors ?? []

  const data = {
    name,
    directoryId,
    ancestors: [...ancestors, directoryId],
    versions: {
      create: {
        name,
        key,
        mimeType,
        size,
      },
    },
  }
  const fileData = await client.file.create({
    data,
    include: { versions: true },
  })
  const bucket = getBucket()
  const url = await bucket.getSignedUrl("put", key)
  return { file: fileData, url }
}

export async function getFile(
  client: PrismaClient,
  id: File["id"]
): Promise<File | null> {
  return await client.file.findUnique({
    where: { id },
    include: { versions: { where: { deletedAt: null } } },
  })
}

export async function moveFile(
  client: PrismaClient,
  id: File["id"],
  directoryId: File["directoryId"]
): Promise<File> {
  const directory = await client.directory.findUnique({
    where: { id: directoryId },
  })
  if (!directory) {
    throw new Error("Invalid target Directory")
  }
  const { ancestors } = directory
  return await client.file.update({
    where: { id },
    data: {
      directoryId,
      ancestors: [...ancestors, directoryId],
    },
    include: { versions: true },
  })
}

export async function renameFile(
  client: PrismaClient,
  id: File["id"],
  name: File["name"]
): Promise<File> {
  return await client.file.update({
    where: { id },
    data: { name },
    include: { versions: true },
  })
}

export async function deleteFile(
  client: PrismaClient,
  id: File["id"]
): Promise<boolean> {
  // const fileVersions = await client.file
  //   .findUnique({ where: { id } })
  //   .versions()
  await client.$transaction([
    client.fileVersion.deleteMany({ where: { fileId: id } }),
    client.file.delete({ where: { id } }),
  ])
  // for (const version of fileVersions) {
  //   await getBucket().deleteObject(version.key)
  // }
  return true
}

export async function findFiles(
  client: PrismaClient,
  query: string
): Promise<File[]> {
  return await client.file.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: [{ name: "asc" }],
    include: { versions: { where: { deletedAt: null } } },
  })
}
