export default function AppLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-zinc-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="ApexFX"
          className="h-20 w-auto drop-shadow-md animate-[softPop_.35s_ease-out]"
        />

        <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />

        <div className="text-sm text-zinc-400">{label}</div>
      </div>
    </div>
  );
}