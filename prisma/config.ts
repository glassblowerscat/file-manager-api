import { PrismaClient } from "@prisma/client"

export function prismaClient(): PrismaClient {
  const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
  })
  return prisma
}
