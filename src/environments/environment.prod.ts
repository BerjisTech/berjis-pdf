const w = typeof window !== 'undefined' ? (window as any) : {};

export const environment = {
  production: true,
  apiBase: w && typeof w.__BERJIS_API__ === 'string' && w.__BERJIS_API__.trim().length
    ? w.__BERJIS_API__.trim()
    : 'https://api.berjis.tech',
  pdfApiBase: w && typeof w.__PDF_API__ === 'string' && w.__PDF_API__.trim().length
    ? w.__PDF_API__.trim()
    : 'https://pdf-api.berjis.tech'
};
