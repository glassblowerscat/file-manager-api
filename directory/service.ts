import { Directory, Prisma, PrismaClient } from "@prisma/client"
import { Pagination } from "../app"
import { deleteFile } from "../file"

export interface DirectoryContentsResult {
  id: string
  name: string
  mimeType: string
  size: number
  key: string
  createdAt: Date
  updatedAt: Date
  type: "File" | "Directory"
}

export interface Sort {
  field: keyof Pick<
    DirectoryContentsResult,
    "name" | "size" | "createdAt" | "updatedAt"
  >
  direction?: "ASC" | "DESC"
}

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

type RawResult = Array<
  Omit<DirectoryContentsResult, "type"> & { type: "1" | "2" }
>

export async function getDirectoryContentsRaw(
  client: PrismaClient,
  id: Directory["id"],
  pagination?: Pagination,
  sort?: Sort
): Promise<DirectoryContentsResult[]> {
  const { field = "name", direction = "ASC" } = sort ?? {}
  const { page = 1, pageLength = 20 } = pagination ?? {}

  const mainQuery = Prisma.sql`
      SELECT f.id, f.name, f.ancestors, f."mimeType", f.size, f.key, EXTRACT(EPOCH FROM f."createdAt") as "createdAt", EXTRACT(EPOCH FROM f."updatedAt") as "updatedAt", '2' as type from
      (SELECT DISTINCT ON (files.id) * from files
        INNER JOIN (SELECT "fileId", "mimeType", size, key, "createdAt" as created_at from file_versions) as fv
          ON fv."fileId" = files.id
        ORDER BY files.id, fv.created_at DESC) as f
    WHERE ${id} = ANY(ancestors)
     AND "deletedAt" IS NULL
    UNION ALL
    SELECT d.id, d.name, d.ancestors, '' as "mimeType", 0 as size, '' as key, EXTRACT(EPOCH FROM d."createdAt") as "createdAt", EXTRACT(EPOCH FROM d."updatedAt") as "updatedAt", '1' as type FROM directories d
    WHERE ${id} = ANY(ancestors)
      AND "deletedAt" IS NULL`

  const paginationSql = Prisma.sql`LIMIT ${pageLength} OFFSET ${
    pageLength * (page - 1)
  }`

  const directionSql = direction === "DESC" ? Prisma.sql`DESC` : Prisma.empty

  const results =
    field === "name"
      ? await client.$queryRaw<RawResult>`
      ${mainQuery}
        ORDER BY name ${directionSql}
      ${paginationSql}
    `
      : field === "size"
      ? await client.$queryRaw<RawResult>`
      ${mainQuery}
        ORDER BY type, size, name ${directionSql}
      ${paginationSql}
    `
      : field === "createdAt"
      ? await client.$queryRaw<RawResult>`
      ${mainQuery}
        ORDER BY type, "createdAt" ${directionSql}
      ${paginationSql}
    `
      : field === "updatedAt"
      ? await client.$queryRaw<RawResult>`
      ${mainQuery}
        ORDER BY type, "updatedAt" ${directionSql}
      ${paginationSql}
    `
      : await client.$queryRaw<RawResult>`
      ${mainQuery}
        ORDER BY name ${directionSql}
      ${paginationSql}
    `
  return results.map((result) => ({
    ...result,
    type: result.type === "1" ? "Directory" : "File",
  }))
}

export async function getDirectoryContents(
  client: PrismaClient,
  id: Directory["id"],
  pagination?: Pagination,
  sort?: Sort
): Promise<DirectoryContentsResult[]> {
  const [files, directories] = await client.$transaction([
    client.file.findMany({
      where: {
        ancestors: {
          has: id,
        },
      },
      include: {
        versions: {
          distinct: ["fileId"],
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    client.directory.findMany({
      where: {
        ancestors: {
          has: id,
        },
      },
    }),
  ])

  const filesWithVersion = files.map((file) => {
    const { id, name, createdAt, updatedAt, versions } = file
    const { mimeType, size, key } = versions[0]
    return {
      id,
      name,
      createdAt,
      updatedAt,
      mimeType,
      size,
      key,
      type: "File" as const,
    }
  })

  const directoriesWithVersion = directories.map((directory) => {
    const { id, name, createdAt, updatedAt } = directory
    return {
      id,
      name,
      createdAt,
      updatedAt,
      mimeType: "",
      size: 0,
      key: "",
      type: "Directory" as const,
    }
  })

  const { field = "name", direction = "ASC" } = sort ?? {}
  const { page = 1, pageLength = 20 } = pagination ?? {}

  const contents =
    field === "name"
      ? [...filesWithVersion, ...directoriesWithVersion].sort((a, b) => {
          return a.name > b.name
            ? direction === "ASC"
              ? 1
              : -1
            : a.name < b.name
            ? direction === "ASC"
              ? -1
              : 1
            : 0
        })
      : [
          ...directoriesWithVersion.sort((a, b) => {
            return a.name > b.name ? 1 : a.name < b.name ? -1 : 0
          }),
          ...filesWithVersion.sort((a, b) => {
            return a[field] > b[field]
              ? direction === "ASC"
                ? 1
                : -1
              : a[field] < b[field]
              ? direction === "ASC"
                ? -1
                : 1
              : 0
          }),
        ]
  const paginatedContents = contents.slice(
    (page - 1) * pageLength,
    (page - 1) * pageLength + pageLength
  )
  return paginatedContents
}

export async function countDirectoryChildren(
  client: PrismaClient,
  id: Directory["id"]
): Promise<number> {
  const [files, directories] = await client.$transaction([
    client.file.count({
      where: {
        ancestors: { has: id },
      },
    }),
    client.directory.count({
      where: {
        ancestors: { has: id },
      },
    }),
  ])
  return directories + files
}

export async function getDirectorySize(
  client: PrismaClient,
  id: Directory["id"]
): Promise<number | null> {
  const {
    _sum: { size },
  } = await client.fileVersion.aggregate({
    _sum: {
      size: true,
    },
    where: {
      file: {
        ancestors: { has: id },
      },
    },
  })
  return size
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
    select: { id: true, ancestors: true, history: true },
  })
  const descendentFilesOfThisDirectory = await client.file.findMany({
    where: {
      ancestors: {
        has: thisDirectory.id,
      },
    },
    select: { id: true, ancestors: true, history: true },
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
          history: [
            ...(file.history &&
            typeof file.history === "object" &&
            Array.isArray(file.history)
              ? file.history
              : []),
            { ancestors: JSON.stringify(updatedAncestors) },
          ],
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
          history: [
            ...(file.history &&
            typeof file.history === "object" &&
            Array.isArray(file.history)
              ? file.history
              : []),
            { ancestors: JSON.stringify(updatedAncestors) },
          ],
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
    where: { ancestors: { has: id }, deletedAt: null },
  })
  for (const file of files) {
    await deleteFile(client, file.id)
  }
  await client.$transaction([
    client.directory.deleteMany({
      where: { ancestors: { has: id }, deletedAt: null },
    }),
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
