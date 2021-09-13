import { createModule, gql } from "graphql-modules"
import { prismaClient } from "../prisma"
import * as fileVersionService from "./service"

export const fileVersionModule = createModule({
  id: "fileVersion-module",
  dirname: __dirname,
  typeDefs: [
    gql`
      type FileVersion implements FileNode {
        id: ID!
        name: String!
        fileId: ID!
        mimeType: String!
        size: Int!
        key: String!
        createdAt: String!
        updatedAt: String!
        versions: [FileVersion]!
      }

      extend type Query {
        getAllFileVersions: [FileVersion]!
        requestFileDownload(key: String!): String!
      }
    `,
  ],
  resolvers: {
    Query: {
      getAllFileVersions: () => {
        return prismaClient().fileVersion.findMany()
      },
      requestFileDownload: async (_: unknown, { key }: { key: string }) => {
        return await fileVersionService.requestFileDownload(key)
      },
    },
  },
})
