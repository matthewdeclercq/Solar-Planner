/**
 * Alpine.js type declarations
 */
declare module 'alpinejs' {
  interface Alpine {
    data(name: string, component: () => Record<string, unknown>): void;
    store(name: string, store: Record<string, unknown>): void;
    store(name: string): Record<string, unknown> | undefined;
    start(): void;
  }
  const Alpine: Alpine;
  export default Alpine;
}
