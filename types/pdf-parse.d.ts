// types/pdf-parse.d.ts

declare module 'pdf-parse' {
  interface PdfMetadata {
    [key: string]: any;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: PdfMetadata | null;
    text: string;
    version: string;
  }

  function pdfParse(
    data: Buffer | Uint8Array | ArrayBuffer
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
