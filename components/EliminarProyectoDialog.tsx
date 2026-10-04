"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIRMACION_ELIMINAR } from "@/lib/project-deletion";

type Props = {
  proyecto: { id: string; nombre: string };
  onCancel: () => void;
  onConfirm: () => void;
};

export default function EliminarProyectoDialog({ proyecto, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const puedeEliminar = confirmacion === CONFIRMACION_ELIMINAR;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="eliminar-proyecto-titulo"
      aria-describedby="eliminar-proyecto-aviso"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-3xl bg-white p-0 text-[#1A1A1A] shadow-xl backdrop:bg-black/60"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (puedeEliminar) onConfirm();
        }}
        className="space-y-5 p-6"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[2px] text-red-700">Acción irreversible</p>
          <h2 id="eliminar-proyecto-titulo" className="mt-1 text-2xl font-bold">Eliminar proyecto</h2>
          <p className="mt-2 break-words font-semibold">{proyecto.nombre}</p>
        </div>

        <div id="eliminar-proyecto-aviso" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">Se eliminarán permanentemente el proyecto y sus datos asociados.</p>
          <p>Esto incluye sus boletas, asignaciones del proyecto y enlaces de venta asociados. No se eliminarán vendedores ni usuarios de la empresa.</p>
        </div>

        <div>
          <label htmlFor="confirmar-eliminar" className="mb-2 block font-medium">
            Escribe <strong>ELIMINAR</strong> para habilitar ACEPTAR
          </label>
          <input
            id="confirmar-eliminar"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={confirmacion}
            onChange={(event) => setConfirmacion(event.target.value)}
            className="w-full rounded-xl border border-[#E0D9CE] px-4 py-3 outline-none focus:border-red-500"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="rounded-xl border border-[#1A1A1A] px-4 py-3 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!puedeEliminar}
            className="rounded-xl bg-red-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            ACEPTAR
          </button>
        </div>
      </form>
    </dialog>
  );
}
