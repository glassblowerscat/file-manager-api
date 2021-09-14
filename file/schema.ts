import { File } from "@prisma/client"
import { createModule, gql } from "graphql-modules"
import { prismaClient } from "../prisma"
import * as fileService from "./service"

export const fileModule = createModule({
  id: "file-module",
  dirname: __dirname,
  typeDefs: [
    gql`
      type File implements FileNode {
        id: ID!
        name: String!
        directoryId: ID!
        createdAt: String!
        updatedAt: String!
        versions: [FileVersion]!
      }

      input CreateFileInput {
        name: String!
        directoryId: ID!
        mimeType: String!
        size: Int!
      }

      type CreateFileResult {
        file: File!
        url: String!
      }

      extend type Query {
        getAllFiles: [File]!
        getFile(id: ID!): File
      }

      extend type Mutation {
        createFile(input: CreateFileInput!): CreateFileResult!
        moveFile(id: ID!, directoryId: ID!): File!
        renameFile(id: ID!, name: String!): File!
        deleteFile(id: ID!): Boolean!
      }
    `,
  ],
  resolvers: {
    Query: {
      getAllFiles: () => {
        return prismaClient().file.findMany()
      },
      getFile: async (
        _: unknown,
        { id }: { id: File["id"] }
      ): Promise<File | null> => {
        return await fileService.getFile(prismaClient(), id)
      },
    },
    Mutation: {
      createFile: async (
        _: unknown,
        { input }: { input: fileService.CreateFileInput }
      ): Promise<{ file: File; url: string }> => {
        return await fileService.createFileRecord(prismaClient(), input)
      },
      moveFile: async (
        _: unknown,
        {
          id,
          directoryId,
        }: { id: File["id"]; directoryId: File["directoryId"] }
      ): Promise<File> => {
        return await fileService.moveFile(prismaClient(), id, directoryId)
      },
      renameFile: async (
        _: unknown,
        { id, name }: { id: File["id"]; name: File["name"] }
      ): Promise<File> => {
        return await fileService.renameFile(prismaClient(), id, name)
      },
      deleteFile: async (
        _: unknown,
        { id }: { id: File["id"] }
      ): Promise<boolean> => {
        return await fileService.deleteFile(prismaClient(), id)
      },
    },
  },
})
