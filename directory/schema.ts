import { Directory } from "@prisma/client"
import { createModule, gql } from "graphql-modules"
import { Pagination } from "../app"
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
        ancestors: [String]!
        createdAt: String!
        updatedAt: String!
        files: [File]!
        directories: [Directory]!
        children: Int!
        size: Int
      }

      type DirectoryContentsResult {
        id: String!
        name: String!
        mimeType: String!
        size: Int!
        key: String!
        createdAt: String!
        updatedAt: String!
        type: String!
      }

      extend type Query {
        getAllDirectories: [Directory]!
        getDirectory(id: ID!): Directory
        getDirectoryContentsRaw(
          id: ID!
          pagination: PaginationInput
          sort: SortInput
        ): [DirectoryContentsResult]!
        getDirectoryContents(
          id: ID!
          pagination: PaginationInput
          sort: SortInput
        ): [DirectoryContentsResult]!
      }

      type Mutation {
        createDirectory(name: String!, parentId: String!): Directory!
        renameDirectory(id: ID!, name: String!): Directory!
        moveDirectory(id: ID!, parentId: ID!): Directory!
        deleteDirectory(id: ID!): Boolean!
      }
    `,
  ],
  resolvers: {
    Directory: {
      children: async ({ id }: { id: string }): Promise<number> => {
        return await directoryService.countDirectoryChildren(prismaClient(), id)
      },
      size: async ({ id }: { id: string }): Promise<number | null> => {
        return await directoryService.getDirectorySize(prismaClient(), id)
      },
    },
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
      getDirectoryContentsRaw: async (
        _: unknown,
        {
          id,
          pagination,
          sort,
        }: {
          id: Directory["id"]
          pagination?: Pagination
          sort?: directoryService.Sort
        }
      ): Promise<directoryService.DirectoryContentsResult[]> => {
        return await directoryService.getDirectoryContentsRaw(
          prismaClient(),
          id,
          pagination,
          sort
        )
      },
      getDirectoryContents: async (
        _: unknown,
        {
          id,
          pagination,
          sort,
        }: {
          id: Directory["id"]
          pagination?: Pagination
          sort?: directoryService.Sort
        }
      ): Promise<directoryService.DirectoryContentsResult[]> => {
        return await directoryService.getDirectoryContents(
          prismaClient(),
          id,
          pagination,
          sort
        )
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
      moveDirectory: async (
        _: unknown,
        { id, parentId }: { id: Directory["id"]; parentId: Directory["id"] }
      ): Promise<Directory> => {
        return await directoryService.moveDirectory(
          prismaClient(),
          id,
          parentId
        )
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
