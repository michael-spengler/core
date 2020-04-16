import fs from 'fs-extra'
import events from 'events'
import { standards } from './standards'

interface Options {
  standard?: (eventEmitter: events.EventEmitter) => {
    unlink?: typeof fs.unlink
    rmdir?: typeof fs.rmdir
  }
  maxBusyTries: number
}

interface ParsedOptions {
  standard: (eventEmitter: events.EventEmitter) => {
    unlink?: typeof fs.unlink
    rmdir?: typeof fs.rmdir
  }
  maxBusyTries: number
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T
type RemoveReturn = ReturnType<typeof remove_>
type Callback = (err: NodeJS.ErrnoException | null, res: any) => ThenArg<RemoveReturn>
type ReturnCallback = events.EventEmitter
type ReturnPromise = {
  events: events.EventEmitter
  result: RemoveReturn
}

export function remove (path: string, options?: Options): ReturnPromise
export function remove (path: string, callback: Callback): ReturnCallback
export function remove (path: string, options: Options, callback: Callback): ReturnCallback

export function remove (path: string, options?: Options | Callback, callback?: Callback): ReturnPromise | ReturnCallback {
  const eventEmitter = new events.EventEmitter()
  if (callback === undefined && typeof options === 'function') {
    callback = options
    // @ts-ignore
    options = { standard: standards.secure }
  }
  // @ts-ignore
  options = options || {}
  // @ts-ignore
  options.standard = options.standard || standards.secure
  if (callback) {
    remove_(path, options as ParsedOptions, eventEmitter)
      .then(result => callback!(null, result))
      .catch(err => callback!(err, null))
    return eventEmitter
  }
  return { events: eventEmitter, result: remove_(path, options as ParsedOptions, eventEmitter) }
}

async function remove_ (path: string, options: ParsedOptions, eventEmitter: events.EventEmitter) {
  let count = 0
  const index: string[] = []
  const update = (path: string) => { count++; index.push(path) }
  eventEmitter.on('mark', update)
  eventEmitter.on('init', update)
  // @ts-ignore
  await fs.remove(path, {
    ...options,
    ...options.standard(eventEmitter)
  })
  eventEmitter.emit('done', path)
  return { count, index }
}
