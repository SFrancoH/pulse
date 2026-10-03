export type CsvBoletaItem = {
  id?: string;
  empresa_id?: string;
  proyecto_id?: string;
  numero: string;
  estado?: string;
  canal?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  vendedor?: string;
  fecha_creacion?: string;
  valor_pagado?: string | number;
};

type CampoCsv = keyof CsvBoletaItem | "proyecto" | "";
type FilaCsv = { valores: string[]; linea: number };

const ALIASES: Record<string, CampoCsv> = {
  id: "id", empresa_id: "empresa_id", proyecto_id: "proyecto_id",
  numero: "numero", nro: "numero", boleta: "numero", consecutivo: "numero", numero_boleta: "numero", n_boleta: "numero",
  estado: "estado", status: "estado",
  canal: "canal", origen: "canal", channel: "canal",
  nombre: "nombre", cliente: "nombre", nombre_cliente: "nombre", full_name: "nombre", name: "nombre",
  telefono: "telefono", telefono_cliente: "telefono", phone: "telefono", celular: "telefono", whatsapp: "telefono",
  email: "email", correo: "email", correo_electronico: "email", email_cliente: "email",
  nombre_vendedor: "vendedor", vendedor_nombre: "vendedor", vendedor: "vendedor", asesor: "vendedor", seller: "vendedor",
  fecha_de_creacion: "fecha_creacion", fecha_creacion: "fecha_creacion", fecha: "fecha_creacion", created_at: "fecha_creacion",
  valor_pagago: "valor_pagado", valor_pagado: "valor_pagado", valor: "valor_pagado", valor_a_pagar: "valor_pagado", pago: "valor_pagado", amount: "valor_pagado",
};

const CAMPOS_SIN_ENCABEZADO: CampoCsv[] = [
  "proyecto", "numero", "estado", "canal", "nombre", "telefono", "email", "vendedor", "fecha_creacion", "valor_pagado",
];

export function normalizarNumeroCsv(valor: unknown) {
  const raw = String(valor ?? "").trim();
  return /^\d{1,4}$/.test(raw) ? raw.padStart(4, "0") : "";
}

function mapearCampo(header: string): CampoCsv {
  const normalizado = header.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return Object.hasOwn(ALIASES, normalizado) ? ALIASES[normalizado] : "";
}

function detectarSeparador(texto: string) {
  let comillas = false;
  let comas = 0;
  let puntosYComa = 0;
  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    if (char === '"') {
      if (comillas && texto[i + 1] === '"') { i++; continue; }
      comillas = !comillas;
    } else if (!comillas) {
      if (char === "\r" || char === "\n") break;
      if (char === ",") comas++;
      if (char === ";") puntosYComa++;
    }
  }
  return puntosYComa > comas ? ";" : ",";
}

function leerFilas(texto: string): FilaCsv[] {
  const separador = detectarSeparador(texto);
  const filas: FilaCsv[] = [];
  let valores: string[] = [];
  let valor = "";
  let comillas = false;
  let cierreComillas = false;
  let linea = 1;
  let inicioFila = 1;

  function cerrarCampo() {
    valores.push(valor.trim());
    valor = "";
    cierreComillas = false;
  }

  function cerrarFila() {
    cerrarCampo();
    if (valores.some(Boolean)) filas.push({ valores, linea: inicioFila });
    valores = [];
  }

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];
    if (comillas) {
      if (char === '"') {
        if (texto[i + 1] === '"') { valor += '"'; i++; }
        else { comillas = false; cierreComillas = true; }
      } else {
        valor += char;
        if (char === "\n") linea++;
      }
    } else if (char === separador) {
      cerrarCampo();
    } else if (char === "\n" || char === "\r") {
      cerrarFila();
      if (char === "\r" && texto[i + 1] === "\n") i++;
      linea++;
      inicioFila = linea;
    } else if (char === '"' && !valor.trim() && !cierreComillas) {
      comillas = true;
      valor = "";
    } else {
      if (char === '"' || (cierreComillas && char.trim())) {
        throw new Error(`Fila ${linea}: comillas inválidas en el CSV.`);
      }
      valor += char;
    }
  }
  if (comillas) throw new Error(`Fila ${inicioFila}: comillas sin cerrar en el CSV.`);
  cerrarFila();
  return filas;
}

export function parseCsvBoletas(texto: string, permitirSinEncabezados = false) {
  const filas = leerFilas(texto.replace(/^\uFEFF/, "").trim());
  const items: CsvBoletaItem[] = [];
  const errores: string[] = [];
  if (!filas.length) return { items, filasLeidas: 0, errores: ["El archivo CSV está vacío."] };

  const header = filas[0].valores.map(mapearCampo);
  const tieneHeader = header.some((campo) => ["numero", "estado", "canal", "id", "empresa_id", "proyecto_id"].includes(campo));
  const campos = tieneHeader ? header : CAMPOS_SIN_ENCABEZADO;
  const datos = tieneHeader ? filas.slice(1) : filas;

  if ((!tieneHeader && !permitirSinEncabezados) || !campos.includes("numero")) {
    return { items, filasLeidas: datos.length, errores: ["El CSV debe incluir la columna numero."] };
  }
  const reconocidos = campos.filter((campo) => campo && campo !== "proyecto");
  if (new Set(reconocidos).size !== reconocidos.length) {
    return { items, filasLeidas: datos.length, errores: ["El CSV contiene columnas repetidas para el mismo campo."] };
  }

  for (const fila of datos) {
    if (fila.valores.length !== campos.length) {
      errores.push(`Fila ${fila.linea}: la cantidad de columnas no coincide con el encabezado.`);
      continue;
    }
    const item: Record<string, string> = {};
    campos.forEach((campo, index) => {
      if (campo && campo !== "proyecto") item[campo] = fila.valores[index];
    });
    const numero = normalizarNumeroCsv(item.numero);
    if (!numero) {
      errores.push(`Fila ${fila.linea}: número inválido (debe tener entre 1 y 4 dígitos).`);
      continue;
    }
    items.push({ ...item, numero });
  }
  return { items, filasLeidas: datos.length, errores };
}
