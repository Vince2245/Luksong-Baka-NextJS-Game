// /components/game/ui/Scoreboard.js
export default function Scoreboard({ score }) {
  return (
    <div className="bg-black/70 text-white px-4 py-2 rounded">
      {score.left} - {score.right}
    </div>
  );
}
