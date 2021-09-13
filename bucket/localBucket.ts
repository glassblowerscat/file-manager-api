import { promises as fs } from "fs"
import { DateTime } from "luxon"
import { dirname, join } from "path"
import { FakeAwsFile, FileBucket, SIGNED_URL_EXPIRES } from "./bucket"

const appRoot = require.main?.paths[0].split("node_modules")[0].slice(0, -1)
const rootDir = `${appRoot ?? "."}/.files`
const baseUrl = `http://localhost:${process.env.LOCAL_PORT ?? 4000}/file`

export function getLocalBucket(): FileBucket {
  return {
    getSignedUrl,
    saveFile,
    deleteObject,
  }
}

function getSignedUrl(operation: "get" | "put", key: string) {
  const signed = JSON.stringify({
    operation,
    key,
    expires: DateTime.local().plus(SIGNED_URL_EXPIRES).toMillis(),
  })
  const url = new URL(baseUrl)
  url.searchParams.set("signed", signed)
  return Promise.resolve(url.toString())
}

function getPath(key: string): string {
  return join(`${rootDir}`, key)
}

const fsWrite = fs.writeFile
async function writeFile(key: string, data: Parameters<typeof fsWrite>[1]) {
  const path = getPath(key)
  await fs.mkdir(dirname(path), {
    recursive: true,
  })
  await fs.writeFile(path, data)
}

export async function saveFile(
  key: string,
  file: FakeAwsFile
): Promise<string> {
  const { Body, ...info } = file
  await writeFile(key, Body)
  await writeFile(
    `${key}.info`,
    JSON.stringify({
      ...info,
      ContentLength: Body.byteLength,
      LastModified: new Date(),
    })
  )
  const url = await getSignedUrl("get", key)
  return url
}

async function deleteObject(key: string) {
  await fs.unlink(getPath(key))
  await fs.unlink(getPath(key) + ".info")
}

export async function downloadLocalFile(
  signedUrl: string
): Promise<FakeAwsFile> {
  const key = validateSignedUrl("get", signedUrl)
  return await getObject(key)
}

export async function uploadLocalFile(
  signedUrl: string,
  file: FakeAwsFile
): Promise<void> {
  const key = validateSignedUrl("put", signedUrl)
  await saveFile(key, {
    ContentLength: file.Body.byteLength,
    LastModified: new Date(),
    ...file,
  })
}

async function getObject(key: string): Promise<FakeAwsFile> {
  const rest = await headObject(key)
  const Body = await fs.readFile(getPath(key))
  return { ...rest, Body }
}

async function headObject(key: string): Promise<FakeAwsFile> {
  const path = getPath(key)
  try {
    await fs.stat(path)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
  }
  const raw = await fs.readFile(path + ".info")
  const parsedInfo = JSON.parse(raw.toString()) as FakeAwsFile
  const info = {
    ...parsedInfo,
    ...(parsedInfo.LastModified
      ? { LastModified: new Date(parsedInfo.LastModified) }
      : {}),
  }
  return info
}

// localhost:4000?signed=%7B%22operation%22%3A%22putObject%22%2C%22key%22%3A%221D8aLzfWEqt%22%2C%22expires%22%3A1630210807938%7D
function validateSignedUrl(operation: "get" | "put", url: string) {
  const searchParams = new URL(url).searchParams
  const rawSigned = searchParams.get("signed") ?? url
  try {
    const signed = JSON.parse(rawSigned) as {
      operation: string
      key: string
      expires: number
    }
    if (signed.operation !== operation) {
      throw new Error("Incorrect operation")
    }
    if (DateTime.local() > DateTime.fromMillis(signed.expires)) {
      throw new Error("URL expired")
    }
    return signed.key
  } catch (error) {
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error("Could not validate URL")
    }
  }
}
