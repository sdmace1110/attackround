import useAuthStore from '../store/authStore'

export default function DmDashboardPage() {
    const logout = useAuthStore((s) => s.logout)

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-semibold">Dashboard</h1>
                <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-white"
                >
                Log out
                </button>
            </div>
        </div>
    )
}