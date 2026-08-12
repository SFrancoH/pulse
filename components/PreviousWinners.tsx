const WINNERS = [
  {
    video: "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a7cdff412ab41108eca78b2.mp4",
    numero: "1504",
    fecha: "8 de agosto de 2026",
  },
  {
    video: "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a4e56bd46e5b517c5054a2f.mp4",
    numero: "8116",
    fecha: "4 de julio de 2026",
  },
  {
    video: "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a2057f1b75a113972d832af.mp4",
    numero: "2106",
    fecha: "30 de mayo de 2026",
  },
  {
    video: "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a4e59c9ac2f159bb0615c4a.mp4",
    numero: "3370",
    fecha: "2 de mayo de 2026",
  },
  {
    video: "https://assets.cdn.filesafe.space/z6D7TmXDOdu2At3H4Tqy/media/6a4e59c98b929b11f2dc5cc5.mp4",
    numero: "6924",
    fecha: "28 de marzo de 2026",
  },
];

function NumeroGanador({ numero }: { numero: string }) {
  return (
    <div className="mt-3 flex gap-2">
      {numero.split("").map((digito, index) => (
        <div
          key={`${numero}-${index}`}
          className="flex h-[54px] w-[48px] items-center justify-center rounded-xl border border-[#E0D9CE] bg-[#F9F6F1] text-[27px] font-black text-[#E8620A]"
        >
          {digito}
        </div>
      ))}
    </div>
  );
}

export default function PreviousWinners() {
  return (
    <section className="bg-[#F2EDE4] px-4 pb-40 pt-10 text-[#1A1A1A] max-[932px]:px-3">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-[4px] text-[#E8620A]">Resultados reales</p>
          <h2 className="mt-2 text-[40px] font-black uppercase leading-none max-[700px]:text-[31px]">
            Ganadores anteriores
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6F665C]">
            Conoce algunos de los números ganadores de nuestros sorteos anteriores y mira los videos de entrega.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
          {WINNERS.map((winner, index) => (
            <article
              key={winner.numero}
              className={[
                "overflow-hidden rounded-[24px] border border-[#E0D9CE] bg-white text-[#1A1A1A] shadow-[0_12px_30px_rgba(0,0,0,0.08)]",
                index === WINNERS.length - 1 ? "col-span-2 mx-auto w-full max-w-[538px] max-[760px]:col-span-1" : "",
              ].join(" ")}
            >
              <div className="px-5 pt-5 sm:px-6 sm:pt-6">
                <div className="relative mx-auto w-full max-w-[310px] overflow-hidden rounded-[22px] bg-black shadow-sm">
                  <video
                    src={winner.video}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] w-full bg-black object-cover"
                  />

                  <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/75 px-3 py-2 text-[11px] font-bold tracking-wide text-white backdrop-blur-sm">
                    <span className="mr-2 text-[#73F49A]">✓</span>
                    Premio entregado
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[2px] text-[#8A8178]">Número ganador</p>
                <NumeroGanador numero={winner.numero} />

                <div className="mt-5 border-l-2 border-[#E8620A] pl-4">
                  <p className="text-xs font-semibold uppercase tracking-[2px] text-[#8A8178]">Sorteo</p>
                  <p className="mt-1 text-lg font-bold text-[#1A1A1A]">{winner.fecha}</p>
                </div>

                <div className="mt-5 rounded-2xl bg-[#F9F6F1] px-4 py-4 text-sm leading-6 text-[#6F665C]">
                  Video de entrega del premio correspondiente al número ganador <strong className="text-[#1A1A1A]">{winner.numero}</strong>.
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
