// dynalite ships no type definitions. Minimal ambient declaration so the
// authed E2E global-setup compiles under strict TS. dynalite() returns an
// http.Server (with the usual listen/close lifecycle). Mirrors
// packages/core/test/dynalite.d.ts.
declare module 'dynalite' {
  import type { Server } from 'node:http'

  interface DynaliteOptions {
    createTableMs?: number
    deleteTableMs?: number
    updateTableMs?: number
    maxItemSizeKb?: number
    path?: string
    ssl?: boolean
    verbose?: boolean
    debug?: boolean
  }

  export default function dynalite(options?: DynaliteOptions): Server
}
