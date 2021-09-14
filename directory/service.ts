import { Directory, PrismaClient } from "@prisma/client"
import { deleteFile } from "../file"

export async function createDirectory(
  client: PrismaClient,
  name: Directory["name"],
  parentId: Directory["parentId"]
): Promise<Directory> {
  if (name === "root") {
    throw new Error("Directory name 'root' is reserved")
  }
  const parent = parentId
    ? await client.directory.findUnique({ where: { id: parentId } })
    : null
  const ancestors = parent?.ancestors ?? []
  const directory = await client.directory.create({
    data: {
      name,
      parentId,
      ancestors: [...ancestors, ...(parentId ? [parentId] : [])],
    },
  })
  return directory
}

export async function getDirectory(
  client: PrismaClient,
  id: Directory["id"]
): Promise<Directory | null> {
  return client.directory.findUnique({
    where: { id },
    include: { directories: true, files: true },
  })
}

export async function renameDirectory(
  client: PrismaClient,
  id: Directory["id"],
  name: Directory["name"]
): Promise<Directory> {
  if (name.toLowerCase() === "root") {
    throw new Error("Directory name 'root' is reserved")
  }
  const directory = await client.directory.findUnique({ where: { id } })
  if (directory?.name === "root") {
    throw new Error("Root directory may not be renamed")
  }
  return client.directory.update({
    where: { id },
    data: { name },
    include: { directories: true, files: true },
  })
}

export async function moveDirectory(
  client: PrismaClient,
  id: Directory["id"],
  parentId: Directory["id"]
): Promise<Directory> {
  const thisDirectory = await client.directory.findUnique({
    where: { id },
    include: { files: true, directories: true },
  })

  if (!thisDirectory) {
    throw new Error("Invalid Directory")
  }

  const destinationDirectory = await client.directory.findUnique({
    where: { id: parentId },
  })

  if (!destinationDirectory || destinationDirectory.ancestors.includes(id)) {
    throw new Error("Invalid target Directory")
  }

  const previousAncestors = thisDirectory.ancestors
  const destinationAncestors = destinationDirectory.ancestors

  const childFilesOfThisDirectory = await client.file.findMany({
    where: { directoryId: id },
    select: { id: true, ancestors: true },
  })
  const descendentFilesOfThisDirectory = await client.file.findMany({
    where: {
      ancestors: {
        has: thisDirectory.id,
      },
    },
    select: { id: true, ancestors: true },
  })
  const descendentDirectoriesOfThisDirectory = await client.directory.findMany({
    where: {
      ancestors: {
        has: thisDirectory.id,
      },
    },
    select: { id: true, ancestors: true },
  })

  const descendentAncestorUpdates = [
    ...childFilesOfThisDirectory.map((file) => {
      const updatedAncestors = [
        ...destinationAncestors,
        destinationDirectory.id,
        thisDirectory.id,
      ]
      return client.file.update({
        where: { id: file.id },
        data: {
          ancestors: updatedAncestors,
        },
      })
    }),
    ...descendentFilesOfThisDirectory.map((file) => {
      const updatedAncestors = [
        ...new Set([
          ...file.ancestors.filter((a) => !previousAncestors.includes(a)),
          ...destinationAncestors,
          destinationDirectory.id,
          thisDirectory.id,
        ]),
      ]
      return client.file.update({
        where: { id: file.id },
        data: {
          ancestors: updatedAncestors,
        },
      })
    }),
    ...descendentDirectoriesOfThisDirectory.map((directory) => {
      const updatedAncestors = [
        ...new Set([
          ...directory.ancestors.filter((a) => !previousAncestors.includes(a)),
          ...destinationAncestors,
          destinationDirectory.id,
          thisDirectory.id,
        ]),
      ]
      return client.directory.update({
        where: { id: directory.id },
        data: {
          ancestors: updatedAncestors,
        },
      })
    }),
  ]

  const childDirectoryAncestorUpdates = client.directory.updateMany({
    where: {
      parentId: thisDirectory.id,
    },
    data: {
      ancestors: [
        ...destinationAncestors,
        destinationDirectory.id,
        thisDirectory.id,
      ],
    },
  })

  await client.$transaction([
    ...descendentAncestorUpdates,
    childDirectoryAncestorUpdates,
    client.directory.update({
      where: { id: thisDirectory.id },
      data: {
        parentId: destinationDirectory.id,
        ancestors: [...destinationAncestors, destinationDirectory.id],
      },
    }),
  ])

  return (await client.directory.findUnique({
    where: { id },
    include: { directories: true, files: true },
  })) as Directory
}

export async function deleteDirectory(
  client: PrismaClient,
  id: Directory["id"]
): Promise<boolean> {
  const files = await client.file.findMany({
    where: { ancestors: { has: id } },
  })
  for (const file of files) {
    await deleteFile(client, file.id)
  }
  await client.$transaction([
    client.directory.deleteMany({ where: { ancestors: { has: id } } }),
    client.directory.delete({ where: { id } }),
  ])
  return true
}

export async function findDirectories(
  client: PrismaClient,
  query: string
): Promise<Directory[]> {
  return await client.directory.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    orderBy: [{ name: "asc" }],
  })
}
