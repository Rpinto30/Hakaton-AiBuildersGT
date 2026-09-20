/// <reference types="vite/client" />

declare module '*.geojson?raw' {
  const source: string
  export default source
}