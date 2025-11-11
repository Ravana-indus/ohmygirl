export default function HomePage() {
  return (
    <main className="p-8">
      <section className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight">Intimate Tamil/Thanglish AI chat & stories</h1>
          <p className="text-gray-600">Adults-only experiences in your language. Create your vibe, save your stories, and continue anytime.</p>
          <div className="flex items-center gap-3">
            <a href="/auth/signin" className="px-4 py-2 rounded-md bg-black text-white">Sign in</a>
            <a href="/stories" className="px-4 py-2 rounded-md border">Start a story</a>
            <a href="/chat" className="px-4 py-2 rounded-md border">Open chat</a>
          </div>
          <p className="text-xs text-gray-500">18+ only. Consensual content guidelines enforced.</p>
        </div>
        <div className="border rounded-xl p-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Recent highlights</div>
            <ul className="text-sm list-disc list-inside text-gray-600 space-y-1">
              <li>WhatsApp-style role-play chat</li>
              <li>Explicit adult stories (consensual only)</li>
              <li>Public library with ratings and views</li>
              <li>Continue any story seamlessly</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
