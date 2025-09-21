export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-100 via-green-100 to-yellow-200 text-gray-900">
      {/* Title */}
      <h1 className="text-6xl font-extrabold mb-3 text-green-800 drop-shadow-lg tracking-tight">
        🐮 Luksong Baka
      </h1>
      <h2 className="text-xl font-semibold mb-6 text-green-700">
        The Filipino Jumping Game — Now in Your Browser!
      </h2>

      {/* Game Description */}
      <div className="bg-white/80 rounded-xl shadow-lg p-6 mb-8 max-w-xl text-center">
        <p className="mb-3">
          <span className="font-bold text-green-700">How to Play:</span> Jump over the <b>baka</b> (the "cow" obstacle) as it gets taller every round. Use your <b>arrow keys</b> to move and <b>spacebar</b> to jump. If you hit the baka, it's game over!
        </p>
        <p>
          <span className="font-bold text-green-700">Goal:</span> See how many levels you can clear. How high can you jump?
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-6">
        <a
          href="/game"
          className="px-8 py-4 bg-green-700 text-white rounded-2xl shadow-lg hover:bg-green-800 transition text-xl font-bold"
        >
          🎮 Start Game
        </a>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-4 bg-gray-200 rounded-2xl shadow-lg hover:bg-gray-300 transition text-xl font-bold"
        >
          📖 GitHub
        </a>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-gray-600 text-sm">
        Made with <span className="text-green-700 font-bold">Next.js</span> &middot; Inspired by Filipino playgrounds 🇵🇭
      </footer>
    </main>
  );
}