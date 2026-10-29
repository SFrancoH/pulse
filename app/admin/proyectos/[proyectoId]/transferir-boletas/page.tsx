import { redirect } from "next/navigation";

type Props = { params: Promise<{ proyectoId: string }> };

// Mantener los enlaces anteriores a la transferencia masiva.
export default async function TransferirBoletasLegacyPage({ params }: Props) {
  const { proyectoId } = await params;
  redirect(`/admin/proyectos/${encodeURIComponent(proyectoId)}/reasignar-numero`);
}
