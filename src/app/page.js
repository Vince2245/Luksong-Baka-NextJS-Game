export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-green-100 text-gray-900">
      {/* Title */}
      <h1 className="text-5xl font-extrabold mb-6">🏐 Sipa Takraw</h1>
      <p className="text-lg mb-8 text-center max-w-lg">
        Welcome to the traditional Filipino game brought to life with Next.js!  
        Play with your friends over LAN in this exciting 2-player experience.
      </p>

      {/* Buttons */}
      <div className="flex gap-6">
        <a
          href="/game"
          className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition"
        >
          🎮 Start Game
        </a>
        <a
          href="https://github.com/"
          target="_blank"
          className="px-6 py-3 bg-gray-200 rounded-xl shadow hover:bg-gray-300 transition"
        >
          📖 View on GitHub
        </a>
      </div>
    </main>
  );
}
