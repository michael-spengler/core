import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import events from 'events'// eslint-disable-line
import { StandardSettings } from './standards'// eslint-disable-line

const folderSet = new Set()

/**
 * Initialize the folder. This function is mandatory.
 * @param folderName The folder that will be processed.
 */
export async function init (folderName: string, { eventEmitter }: StandardSettings) {
  const files = await fs.readdir(folderName)
  if (files.length) {
    // will throw error
    await fs.rmdir(folderName)
  }
  eventEmitter.emit('init', folderName)
  return { folderName, eventEmitter }
}

/**
 * Remove the folder. This function is mandatory.
 * @param folderData Generated by function init.
 */
export async function end ({ folderName, eventEmitter }: FolderData) {
  await fs.rmdir(folderName)
  eventEmitter.emit('removed', folderName)
}

/**
 * Rename the directory to a random string of length 12.
 * @param folderData Generated by function init.
 */
export async function rename ({ folderName, eventEmitter }: FolderData) {
  const newName = crypto.randomBytes(9).toString('base64').replace(/\//g, '0').replace(/\+/g, 'a')
  const newPath = path.join(path.dirname(folderName), newName)
  await fs.rename(folderName, newPath)
  return { folderName: newPath, eventEmitter }
}

/**
 * Mark the folder, does nothing.
 * @param folderName The folder that will be processed.
 */
export async function mark (folderName: string, { eventEmitter }: StandardSettings) {
  const files = await fs.readdir(folderName)
  if (files.length) {
    if (folderSet.has(folderName)) {
      folderSet.delete(folderName)
      eventEmitter.emit('mark', folderName)
    } else {
      folderSet.add(folderName)
      // will throw error
      await fs.rmdir(folderName)
    }
  } else {
    eventEmitter.emit('mark', folderName)
  }
}

interface FolderData {
  folderName: string
  eventEmitter: events.EventEmitter
}
