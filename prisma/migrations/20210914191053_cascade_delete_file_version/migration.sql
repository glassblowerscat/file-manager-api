-- DropForeignKey
ALTER TABLE "file_versions" DROP CONSTRAINT "file_versions_fileId_fkey";

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
