/*
  Warnings:

  - Added the required column `key` to the `file_versions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "file_versions" ADD COLUMN     "key" TEXT NOT NULL;
