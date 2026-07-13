import { Suspense } from "react";
import BoletaClient from "./BoletaClient";

export default function BoletaPublicaPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#F2EDE4] p-5 text-[#1A1A1A]"><p className="text-lg font-semibold">Consultando boleta...</p></main>}>
      <BoletaClient />
    </Suspense>
  );
}
