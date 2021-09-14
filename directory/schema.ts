import { Directory } from "@prisma/client"
import { createModule, gql } from "graphql-modules"
import { prismaClient } from "../prisma"
import * as directoryService from "./service"

export const directoryModule = createModule({
  id: "directory-module",
  dirname: __dirname,
  typeDefs: [
    gql`
      type Directory implements FileNode {
        id: ID!
        name: String!
        parentId: ID
        createdAt: String!
        updatedAt: String!
        files: [File]!
        directories: [Directory]!
      }

      extend type Query {
        getAllDirectories: [Directory]!
        getDirectory(id: ID!): Directory
      }

      type Mutation {
        createDirectory(name: String!, parentId: String!): Directory!
        renameDirectory(id: ID!, name: String!): Directory!
        deleteDirectory(id: ID!): Boolean!
      }
    `,
  ],
  resolvers: {
    Query: {
      getAllDirectories: () => {
        return prismaClient().directory.findMany()
      },
      getDirectory: async (
        _: unknown,
        { id }: { id: Directory["id"] }
      ): Promise<Directory | null> => {
        return await directoryService.getDirectory(prismaClient(), id)
      },
    },
    Mutation: {
      createDirectory: async (
        _: unknown,
        { name, parentId }: { name: string; parentId: string }
      ) => {
        return await directoryService.createDirectory(
          prismaClient(),
          name,
          parentId
        )
      },
      renameDirectory: async (
        _: unknown,
        { id, name }: { id: Directory["id"]; name: Directory["name"] }
      ): Promise<Directory> => {
        return await directoryService.renameDirectory(prismaClient(), id, name)
      },
      deleteDirectory: async (
        _: unknown,
        { id }: { id: Directory["id"] }
      ): Promise<boolean> => {
        return await directoryService.deleteDirectory(prismaClient(), id)
      },
    },
  },
})
