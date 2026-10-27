import '@testing-library/jest-dom/vitest';

// jsdom ไม่มี ResizeObserver (Recharts ใช้)
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= RO as unknown as typeof ResizeObserver;
