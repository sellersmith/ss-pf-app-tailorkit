import type { Server } from 'socket.io'

declare module '*.css'

declare namespace NodeJS {
  interface ProcessEnv {
    readonly MONGODB_URI: string
  }
}

interface MyShopify {
  tailorkit: {
    [key: string]: any
  }
}

interface Window {
  [key: string]: any
  shopify: MyShopify & ShopifyGlobal
}

type RequestBody = {
  payload?: any
}

type RequestOptions = RequestInit & RequestBody

declare global {
  const GlobalWebSocketInstance: Server | undefined
}
