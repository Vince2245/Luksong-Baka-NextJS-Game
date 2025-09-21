// /components/game/ui/ServeIndicator.js
export default function ServeIndicator({ countdown }) {
  return (
    <div className="text-white text-lg font-bold">
      {countdown > 0 ? `Serve in: ${countdown}` : ""}
    </div>
  );
}
