import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import useCampaignStore from '../store/campaignStore'

export default function DmDashboardPage() {
  const logout = useAuthStore((s) => s.logout)
  const { campaigns, fetchCampaigns, createCampaign } = useCampaignStore()
  const [showModal, setShowModal] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!campaignName.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createCampaign(campaignName.trim())
      setCampaignName('')
      setShowModal(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setCampaignName('')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-white">
            Log out
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium">Campaigns</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + New Campaign
          </button>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-gray-500 mt-6">No campaigns yet. Create one to get started.</p>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/dm/campaign/${c.id}`}
                  className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg px-5 py-4 transition-colors"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-400 text-sm">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">New Campaign</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                placeholder="Campaign name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                autoFocus
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
                >
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}