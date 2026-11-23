declare module 'momai:sdk' {
  const sdk: any
  export default sdk
  export const api: any
  export const storage: any
  export const sessionFiles: any
  export const collections: any
  export const media: any
  export const events: any
  export const llm: any
  export const embeddings: any
  export const billing: any
  export const registry: any
  export const chat: any
  export const share: any
  export const notifications: any
  export const badge: any
  export const overlay: any
  export const ui: any
  export const clipboard: any
  export const dialog: any
  export const camera: any
  export const jobs: any
  export const i18n: any
  export const tts: any
  export const has: (method: string) => boolean
  export const dev: any
  export const useExtensionVisibility: any
  export const useWarmup: any
  export const useCachedState: any
  export const useShare: any
  export const ContextMenu: any
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}
