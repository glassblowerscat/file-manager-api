import { File, FileVersion, Prisma, PrismaClient } from "@prisma/client"
import { getBucket } from "../bucket/bucket"
import { CreateFileVersionInput } from "../fileVersion"
import { generateId } from "../util/generators"

const fileInputFields = Prisma.validator<Prisma.FileArgs>()({
  select: { name: true, directoryId: true },
})

export type CreateFileInput = Prisma.FileGetPayload<typeof fileInputFields> &
  Omit<CreateFileVersionInput, "fileId" | "key"> & { key?: FileVersion["key"] }

export async function updateFileHistory(
  client: PrismaClient,
  id: File["id"],
  entry: Record<string, string | number | boolean>
): Promise<Prisma.JsonArray> {
  const file = await client.file.findUnique({
    where: { id },
    select: { history: true },
  })

  if (!file) {
    throw new Error("File not found")
  }

  const history =
    file.history &&
    typeof file.history === "object" &&
    Array.isArray(file.history)
      ? file.history
      : []
  const updatedHistory = [
    ...history,
    {
      ...entry,
      date: new Date().toString(),
    },
  ]
  return updatedHistory
}

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
    history: [
      {
        action: "created",
        name,
        mimeType,
        size,
        directoryId,
      },
    ],
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
  const updatedHistory = await updateFileHistory(client, id, {
    directory: directory.id,
  })
  return await client.file.update({
    where: { id },
    data: {
      directoryId,
      ancestors: [...ancestors, directoryId],
      history: updatedHistory,
    },
    include: { versions: true },
  })
}

export async function renameFile(
  client: PrismaClient,
  id: File["id"],
  name: File["name"]
): Promise<File> {
  const updatedHistory = await updateFileHistory(client, id, { name })
  return await client.file.update({
    where: { id },
    data: { name, history: updatedHistory },
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
  const updatedHistory = await updateFileHistory(client, id, { deleted: true })
  await client.$transaction([
    client.file.update({ where: { id }, data: { history: updatedHistory } }),
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
