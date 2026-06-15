/// <reference types="vite/client" />

declare module "html2pdf.js" {
  // html2pdf returns a chainable worker whose internal type is not exported.
  // Treat as unknown at the boundary; callers cast as needed.
  const html2pdf: () => unknown;
  export default html2pdf;
}
