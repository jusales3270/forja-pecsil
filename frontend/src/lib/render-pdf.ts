// ============================================================
// Forja - Renderiza páginas de PDF como imagens (pdf.js)
// Usado pelo visualizador de desenhos: a imagem permite prévia
// proporcional e zoom/arraste próprios (o <iframe> não permite).
// ============================================================

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// pdf.js 4.x usa Promise.withResolvers; navegadores mais antigos do tótem não têm.
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

GlobalWorkerOptions.workerSrc = workerUrl;

export interface PaginaRenderizada {
  url: string;
  largura: number;
  altura: number;
}

/** Lado maior da imagem gerada: nítido para ler cotas e dentro do limite de canvas do iOS. */
const LADO_MAIOR_PX = 4096;

export async function renderizarPdfComoImagens(blob: Blob): Promise<PaginaRenderizada[]> {
  const dados = new Uint8Array(await blob.arrayBuffer());
  const pdf = await getDocument({ data: dados }).promise;
  const paginas: PaginaRenderizada[] = [];

  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const escala = LADO_MAIOR_PX / Math.max(base.width, base.height);
      const viewport = pagina.getViewport({ scale: escala });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');

      // Fundo branco: PDFs sem fundo ficariam transparentes sobre o modal escuro
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport }).promise;

      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem da página'))), 'image/png'),
      );
      paginas.push({ url: URL.createObjectURL(png), largura: canvas.width, altura: canvas.height });

      // Libera a memória do canvas grande
      canvas.width = 0;
      canvas.height = 0;
      pagina.cleanup();
    }
  } catch (err) {
    paginas.forEach((p) => URL.revokeObjectURL(p.url));
    throw err;
  } finally {
    await pdf.destroy();
  }

  return paginas;
}
