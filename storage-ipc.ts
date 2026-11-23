import fs from 'node:fs/promises'
import path from 'node:path'

function codedError(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string }
  err.code = code
  return err
}

export interface CreateIpcStorageOptions {
  send?: (msg: unknown) => void
  onResponse?: (fn: (msg: any) => void) => void
  storageDir?: string
  timeoutMs?: number
}

export function createIpcDocsStorage({
  send,
  onResponse,
  storageDir,
  timeoutMs = 30000
}: CreateIpcStorageOptions = {}) {
  let seq = 0
  const pending = new Map<
    string,
    { resolve: (value: any) => void; reject: (err: Error) => void; timer: NodeJS.Timeout }
  >()

  onResponse?.((msg) => {
    if (!msg || msg.type !== 'storage-response' || !msg.requestId) return
    const entry = pending.get(msg.requestId)
    if (!entry) return
    pending.delete(msg.requestId)
    clearTimeout(entry.timer)
    const result = msg.result || {}
    if (result.ok === false) {
      entry.reject(codedError(result.errorCode || 'storage_error', result.error || 'storage request failed'))
      return
    }
    entry.resolve(result.value)
  })

  function call(method: string, args: unknown[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `docs-${Date.now()}.${seq++}`
      const timer = setTimeout(() => {
        pending.delete(requestId)
        reject(new Error(`storage IPC timeout: ${method}`))
      }, timeoutMs)
      if (typeof timer.unref === 'function') timer.unref()
      pending.set(requestId, { resolve, reject, timer })
      try {
        send?.({ type: 'storage-request', requestId, method, args, extensionId: 'momai-docs' })
      } catch (err: any) {
        pending.delete(requestId)
        clearTimeout(timer)
        reject(err)
      }
    })
  }

  function area<T extends Record<string, (...args: any[]) => Promise<any>>>(
    prefix: string,
    methods: Array<keyof T & string>
  ): T {
    return Object.fromEntries(
      methods.map((name) => [name, (...args: unknown[]) => call(`${prefix}.${name}`, args)])
    ) as T
  }

  const storageMethods = area<any>('storage', [
    'get',
    'set',
    'getMany',
    'setMany',
    'delete',
    'listKeys',
    'migrate'
  ])

  return {
    storage: {
      storageDir,
      get: storageMethods.get,
      set: async (key: string, value: unknown, opts?: { version?: string; ttlMs?: number }) => {
        await call('storage.set', opts === undefined ? [key, value] : [key, value, opts])
      },
      getMany: storageMethods.getMany,
      setMany: storageMethods.setMany,
      delete: async (key: string, opts?: { version?: string }) => {
        await call('storage.delete', opts === undefined ? [key] : [key, opts])
      },
      listKeys: storageMethods.listKeys,
      migrate: storageMethods.migrate
    },
    collections: area<any>('collections', [
      'insert',
      'list',
      'count',
      'search',
      'remove',
      'clear',
      'upsert',
      'upsertMany'
    ]),
    sessionFiles: (() => {
      const baseRoot = storageDir ? path.resolve(storageDir, 'files') : ''
      const resolveSafe = (relPath: string) => {
        if (!baseRoot) return ''
        const cleaned = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
        const target = path.resolve(baseRoot, cleaned)
        const rel = path.relative(baseRoot, target)
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
          throw codedError('invalid_path', `Invalid session file path: ${relPath}`)
        }
        return target
      }
      return {
        async write(relPath: string, data: Uint8Array | Buffer | string): Promise<{ ok: boolean; path: string }> {
          if (!baseRoot) {
            const b64 = typeof data === 'string' ? Buffer.from(data, 'utf8').toString('base64') : Buffer.from(data).toString('base64')
            await call('storage.set', [`__file:${relPath}`, b64])
            return { ok: true, path: relPath }
          }
          const target = resolveSafe(relPath)
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.writeFile(target, typeof data === 'string' ? Buffer.from(data, 'utf8') : data)
          return { ok: true, path: relPath }
        },
        async read(relPath: string): Promise<{ bytes: Uint8Array; text: string }> {
          if (!baseRoot) {
            const b64 = await call('storage.get', [`__file:${relPath}`])
            if (typeof b64 !== 'string') throw codedError('not_found', `File not found: ${relPath}`)
            const buf = Buffer.from(b64, 'base64')
            return { bytes: new Uint8Array(buf), text: buf.toString('utf8') }
          }
          const target = resolveSafe(relPath)
          const buf = await fs.readFile(target)
          return { bytes: new Uint8Array(buf), text: buf.toString('utf8') }
        },
        async list(prefix = ''): Promise<string[]> {
          if (!baseRoot) {
            const keys: string[] = await call('storage.listKeys', [{ prefix: `__file:${prefix}` }])
            return keys.map((k) => k.slice('__file:'.length))
          }
          const out: string[] = []
          const walk = async (dir: string) => {
            let entries: any[] = []
            try {
              entries = await fs.readdir(dir, { withFileTypes: true })
            } catch {
              return
            }
            for (const entry of entries) {
              const full = path.join(dir, entry.name)
              if (entry.isDirectory()) await walk(full)
              else {
                const rel = path.relative(baseRoot, full).replace(/\\/g, '/')
                if (!prefix || rel.startsWith(prefix)) out.push(rel)
              }
            }
          }
          await walk(baseRoot)
          return out
        },
        async remove(relPath: string): Promise<{ ok: boolean }> {
          if (!baseRoot) {
            await call('storage.delete', [`__file:${relPath}`])
            return { ok: true }
          }
          const target = resolveSafe(relPath)
          await fs.rm(target, { force: true })
          return { ok: true }
        }
      }
    })()
  }
}
