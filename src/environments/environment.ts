type PdfWindow = Window & {
  __BERJIS_API__?: string;
  __PDF_API__?: string;
};

const w: PdfWindow | undefined = typeof window !== 'undefined' ? (window as PdfWindow) : undefined;

export const environment = {
  production: false,
  apiBase: w && typeof w.__BERJIS_API__ === 'string' && w.__BERJIS_API__.trim().length
    ? w.__BERJIS_API__.trim()
    : 'https://api.berjis.tech',
  pdfApiBase: w && typeof w.__PDF_API__ === 'string' && w.__PDF_API__.trim().length
    ? w.__PDF_API__.trim()
    : 'https://pdf-api.berjis.tech'
};
