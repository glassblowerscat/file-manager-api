import { Directory, PrismaClient } from "@prisma/client"

export async function createDirectory(
  client: PrismaClient,
  name: Directory["name"],
  parentId: Directory["parentId"]
): Promise<Directory> {
  if (name === "root") {
    throw new Error("Directory name 'root' is reserved")
  }
  const directory = await client.directory.create({
    data: {
      name,
      parentId,
    },
  })
  return directory
}
