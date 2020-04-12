import fs from 'fs-extra'
import path from 'path'
import util from 'util'
import crypto from 'crypto'
import { kMaxLength } from 'buffer'
import { eventEmitter } from './events'

/**
 * Open the file. This function is mandatory.
 * @param fileName The file that will be processed.
 */
export async function init (fileName: string): Promise<FileData> {
  const fileSize = (await fs.stat(fileName)).size
  const fd = await fs.open(fileName, 'r+')
  return { fd, fileName, fileSize }
}

/**
 * Close and unlink the file. This function is mandatory.
 * @param fileData Generated by function init.
 */
export async function end ({ fd, fileName }: FileData) {
  await fs.close(fd)
  await fs.unlink(fileName)
  eventEmitter.emit('removed', fileName)
}

/**
 * Mark the file, does nothing.
 * @param fileName The file that will be processed.
 */
export async function mark (fileName: string) {
  eventEmitter.emit('mark', fileName)
}

/**
 * Write cryptographically strong pseudo-random data.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 */
export async function random ({ fd, fileSize }: FileData, { passes = 1 }: Options = {}) {
  for (let i = 0; i < passes; i++) {
    await writeExtended(fd, fileSize, 0, async bufferSize => randomBytes(bufferSize))
  }
}

/**
 * Write zeros on the whole file.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 */
export async function zeros ({ fd, fileSize }: FileData, { passes = 1 }: Options = {}) {
  for (let i = 0; i < passes; i++) {
    await writeExtended(fd, fileSize, 0, async bufferSize => Buffer.alloc(bufferSize, 0b00000000))
  }
}

/**
 * Write ones on the whole file.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 */
export async function ones ({ fd, fileSize }: FileData, { passes = 1 }: Options = {}) {
  for (let i = 0; i < passes; i++) {
    await writeExtended(fd, fileSize, 0, async bufferSize => Buffer.alloc(bufferSize, 0b11111111))
  }
}

/**
 * Write one byte on the whole file.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 * @param data A byte: must be between `0x00` and `0xFF` (Hexadecimal)
 */
export async function byte ({ fd, fileSize }: FileData, { passes = 1, data }: ByteOptions) {
  for (let i = 0; i < passes; i++) {
    await writeExtended(fd, fileSize, 0, async bufferSize => Buffer.alloc(bufferSize, data))
  }
}

/**
 * Write an array of bytes on the whole file.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 * @param data The array containing the bytes.
 */
export async function byteArray ({ fd, fileSize }: FileData, { passes = 1, data }: ByteArrayOptions) {
  const dataConverted = Buffer.from(data)
  for (let i = 0; i < passes; i++) {
    await writeExtended(fd, fileSize, 0, async bufferSize => Buffer.alloc(bufferSize, dataConverted))
  }
}

/**
 * A for loop, write the value of the variable at each iteration.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 * @param forLoop Initial value, condition, increment.
 */
export async function forByte ({ fd, fileSize }: FileData, { initial, condition, increment }: ForByteOptions) {
  for (let i = initial; condition(i); i = increment(i)) {
    await writeExtended(fd, fileSize, 0, async bufferSize => Buffer.alloc(bufferSize, i))
  }
}

/**
 * Write one cryptographically strong pseudo-random byte on the whole file.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 */
export async function randomByte ({ fd, fileSize }: FileData, { passes = 1 }: Options = {}) {
  const data = (await randomBytes(1))[0]
  for (let i = 0; i < passes; i++) {
    await writeExtended(fd, fileSize, 0, async bufferSize => Buffer.alloc(bufferSize, data))
  }
}

/**
 * Write the binary complement of the file.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 */
export async function complementary ({ fd, fileSize }: FileData, { passes = 1 }: Options = {}) {
  for (let i = 0; i < passes; i++) {
    await writeExtended(fd, fileSize, 0, async (bufferSize, pos) => {
      const data = (await fs.read(fd, Buffer.alloc(bufferSize), 0, bufferSize, pos)).buffer
      for (let i = 0; i < bufferSize; i++) {
        data[i] = ~data[i]
      }
      return data
    })
  }
}

/**
 * Rename the file to a random string of length 12.
 * @param fileData Generated by function init.
 */
export async function rename ({ fd, fileName }: FileData) {
  await fs.close(fd)
  const newName = crypto.randomBytes(9).toString('base64').replace(/\//g, '0').replace(/\+/g, 'a')
  const newPath = path.join(path.dirname(fileName), newName)
  await fs.rename(fileName, newPath)
  return init(newPath)
}

/**
 * Truncate to between 25% and 75% of the file size.
 * @param fileData Generated by function init.
 * @param passes The number of times the function is executed.
 */
export async function truncate ({ fd, fileSize }: FileData, { passes = 1 }: Options = {}) {
  for (let i = 0; i < passes; i++) {
    const newSize = Math.floor((0.25 + Math.random() * 0.5) * fileSize)
    await fs.ftruncate(fd, newSize)
    fileSize = newSize
  }
}

/**
 * Reset file timestamps to 1970-01-01T00:00:00.000Z.
 * @param fileData Generated by function init.
 */
export async function resetTimestamps ({ fd }: FileData) {
  await futimes(fd, new Date(0), new Date(0))
}

/**
 * Randomize file timestamps to a random value between date1 and date2.
 * Setting the same value to date1 and date2 will take away the randomness.
 * @param fileData Generated by function init.
 * @param date1 Date will be greater than or equal date1.
 * @param date2 Date will be less than or equal date2.
 */
export async function changeTimestamps ({ fd }: FileData, { date1 = new Date(0), date2 = new Date() }: RandomTimestampsOptions = {}) {
  const date = new Date(randomValueBetween(date2.getTime(), date1.getTime()))
  await futimes(fd, date, date)
}

/**
 * Internal API.
 * Allows writing to a file of any size.
 * @param fd File descriptor.
 * @param size Size of the file.
 * @param pos Current file position (recursive function).
 * @param getBuffer Function that returns a buffer to write.
 */
export async function writeExtended (fd: number, size: number, pos: number, getBuffer: (bufferSize: number, pos: number) => Promise<Buffer>): Promise<void> {
  if (size - pos <= kMaxLength) {
    const data = await getBuffer(size - pos, pos)
    await fs.write(fd, data, 0, size - pos, pos)
    return Promise.resolve()
  }
  const data = await getBuffer(kMaxLength, pos)
  await fs.write(fd, data, 0, kMaxLength, pos)
  return writeExtended(fd, size, pos + kMaxLength, getBuffer)
}

function randomValueBetween (min: number, max: number) {
  return Math.random() * (max - min) + min
}

const randomBytes = util.promisify(crypto.randomBytes)
const futimes = util.promisify(fs.futimes)

interface FileData {
  fd: number
  fileName: string
  fileSize: number
}

interface Options {
  passes?: number
}

interface ByteOptions extends Options {
  data: number
}

interface ByteArrayOptions extends Options {
  data: number[]
}

interface ForByteOptions {
  initial: number
  condition: (i: number) => boolean
  increment: (i: number) => number
}

interface RandomTimestampsOptions {
  date1?: Date
  date2?: Date
}
