import { customAlphabet } from "nanoid/async"

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const size = 11
export const generateId = customAlphabet(alphabet, size)
