import { createModule, gql } from "graphql-modules"
import { prismaClient } from "../prisma"

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
        createdAt: String!
        updatedAt: String!
        versions: [FileVersion]!
      }

      extend type Query {
        getAllFileVersions: [FileVersion]!
      }
    `,
  ],
  resolvers: {
    Query: {
      getAllFileVersions: () => {
        return prismaClient().fileVersion.findMany()
      },
    },
  },
})
