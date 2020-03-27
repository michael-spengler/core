import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'

/**
  * Rename the directory to a random string of length 12.
  * @param folderName The folder that will be processed
  */
export async function rename (folderName: string) {
  const files = await fs.readdir(folderName)
  if (files.length) {
    // will throw error
    await fs.rmdir(folderName)
    throw new Error('If this message appears, something went wrong')
  } else {
    const newName = crypto.randomBytes(9).toString('base64').replace(/\//g, '0').replace(/\+/g, 'a')
    const newPath = path.join(path.dirname(folderName), newName)
    await fs.rename(folderName, newPath)
    return newPath
  }
}
