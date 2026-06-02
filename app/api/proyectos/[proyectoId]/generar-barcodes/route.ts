import bwipjs from "bwip-js";
import JSZip from "jszip";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    proyectoId: string;
  }>;
};

type Boleta = {
  id: string;
  numero: string;
  proyecto_id: string;
};

const MAX_POR_ZIP = 1000;

function numeroDesdeSearch(searchParams: URLSearchParams, key: string, fallback: number) {
  const value = Number(searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(9999, value));
}

function bufferToArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function cargarBoletas(proyectoId: string, desde: number, hasta: number) {
  const desdeTexto = String(desde).padStart(4, "0");
  const hastaTexto = String(hasta).padStart(4, "0");

  const { data, error } = await supabaseAdmin
    .from("boletas")
    .select("id,numero,proyecto_id")
    .eq("proyecto_id", proyectoId)
    .gte("numero", desdeTexto)
    .lte("numero", hastaTexto)
    .order("numero", { ascending: true });

  if (error) throw error;

  return (data || []) as Boleta[];
}

async function crearImagenBarcode(boleta: Boleta) {
  const codigo = boleta.numero;

  const barcode = await bwipjs.toBuffer({
    bcid: "code39",
    text: codigo,
    scale: 5,
    height: 18,
    includetext: true,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
  });

  const svg = `
    <svg width="1400" height="900" xmlns="http://www.w3.org/2000/svg">
      <rect width="1400" height="900" fill="#ffffff"/>
      <text x="700" y="110" text-anchor="middle" font-family="Arial" font-size="62" font-weight="700" fill="#111111">BOLETA ${boleta.numero}</text>
      <text x="700" y="190" text-anchor="middle" font-family="Arial" font-size="28" fill="#444444">Código para asignación rápida</text>
      <text x="700" y="830" text-anchor="middle" font-family="Arial" font-size="24" fill="#555555">${codigo}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .composite([{ input: barcode, top: 260, left: 120 }])
    .png()
    .toBuffer();
}

export async function GET(req: Request, { params }: PageProps) {
  try {
    const { proyectoId } = await params;
    const url = new URL(req.url);
    const desde = numeroDesdeSearch(url.searchParams, "desde", 0);
    const hastaSolicitado = numeroDesdeSearch(url.searchParams, "hasta", Math.min(desde + MAX_POR_ZIP - 1, 9999));
    const hasta = Math.min(hastaSolicitado, desde + MAX_POR_ZIP - 1, 9999);

    if (hasta < desde) {
      return Response.json(
        { success: false, message: "El rango no es válido." },
        { status: 400 }
      );
    }

    const boletas = await cargarBoletas(proyectoId, desde, hasta);

    if (boletas.length === 0) {
      return Response.json(
        { success: false, message: "No se encontraron boletas para ese rango." },
        { status: 404 }
      );
    }

    const zip = new JSZip();

    for (const boleta of boletas) {
      const imagen = await crearImagenBarcode(boleta);
      zip.file(`${boleta.numero}.png`, imagen);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipArrayBuffer = bufferToArrayBuffer(zipBuffer);
    const fileName = `barcodes-${proyectoId}-${String(desde).padStart(4, "0")}-${String(hasta).padStart(4, "0")}.zip`;

    return new Response(zipArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
