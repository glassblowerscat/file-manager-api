# File Manager API

**NOTE: This repo was intended for use in a tutorial series on Prisma and should not be used as-is for production.**

API for storing files in Amazon S3 and managing metadata for those files using Prisma as the ORM for a PostgreSQL database. When `NODE_ENV === 'development'`, a local "bucket" that stores files in a hidden subfolder of the root directory will be used instead of an actual S3 bucket. This allows the developer to work on the API without incurring AWS fees or requiring the S3 bucket to configure CORS too liberally.

The API is a hybrid GraphQL/REST API when used for local development. The GraphQL endpoint is used for actually managing file metadata, and two REST endpoints allow the developer to simulate S3 presigned URLs for downloading/uploading files.
