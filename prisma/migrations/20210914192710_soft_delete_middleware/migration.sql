-- AlterTable
ALTER TABLE "directories" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "file_versions" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "deletedAt" TIMESTAMP(3);
