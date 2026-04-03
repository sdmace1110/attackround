import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import useCampaignStore from '../store/campaignStore'

const STATUS_OPTIONS = ['active', 'unconscious', 'stable', 'dead']
const CLASS_OPTIONS = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer',
]

const EMPTY_ADD_FORM = { name: '', char_class: '', level: 1, max_hp: '' }

export default function CampaignPage() {
  const { id } = useParams()
  const { campaigns, characters, fetchCampaigns, fetchCharacters, addCharacter, updateCharacter, deleteCharacter } =
    useCampaignStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [addError, setAddError] = useState(null)
  const [addLoading, setAddLoading] = useState(false)

  const [editingChar, setEditingChar] = useState(null) // character object being edited
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  const campaign = campaigns.find((c) => c.id === id)

  useEffect(() => {
    if (campaigns.length === 0) fetchCampaigns()
    fetchCharacters(id)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!addForm.name.trim() || !addForm.char_class || !addForm.max_hp) return
    setAddLoading(true)
    setAddError(null)
    try {
      await addCharacter(id, {
        name: addForm.name.trim(),
        char_class: addForm.char_class,
        level: Number(addForm.level),
        max_hp: Number(addForm.max_hp),
      })
      setAddForm(EMPTY_ADD_FORM)
      setShowAddForm(false)
    } catch (err) {
      setAddError(err.response?.data?.detail || 'Failed to add character')
    } finally {
      setAddLoading(false)
    }
  }

  const openEdit = (char) => {
    setEditingChar(char)
    setEditForm({
      name: char.name,
      char_class: char.char_class,
      level: char.level,
      max_hp: char.max_hp,
      current_hp: char.current_hp,
      status: char.status,
    })
    setEditError(null)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    try {
      await updateCharacter(editingChar.id, {
        name: editForm.name.trim(),
        char_class: editForm.char_class,
        level: Number(editForm.level),
        max_hp: Number(editForm.max_hp),
        current_hp: Number(editForm.current_hp),
        status: editForm.status,
      })
      setEditingChar(null)
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update character')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (char) => {
    if (!window.confirm(`Remove ${char.name} from this campaign?`)) return
    try {
      await deleteCharacter(char.id)
    } catch {
      // silently ignore; character list won't update on error
    }
  }

  const inputClass =
    'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500'
  const selectClass = inputClass

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/dm/dashboard" className="text-gray-400 hover:text-white text-sm">
            ← Dashboard
          </Link>
          <span className="text-gray-600">/</span>
          <h1 className="text-2xl font-semibold">{campaign?.name ?? 'Campaign'}</h1>
        </div>

        {/* Roster header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Character Roster</h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + Add Character
          </button>
        </div>

        {/* Roster table */}
        {characters.length === 0 ? (
          <p className="text-gray-500 mt-6">No characters yet. Add your first one!</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-center">Lvl</th>
                  <th className="px-4 py-3 text-center">HP</th>
                  <th className="px-4 py-3 text-center">Max HP</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {characters.map((char, i) => (
                  <tr
                    key={char.id}
                    className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}
                  >
                    <td className="px-4 py-3 font-medium">{char.name}</td>
                    <td className="px-4 py-3 text-gray-300">{char.char_class}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{char.level}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{char.current_hp}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{char.max_hp}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          char.status === 'active'
                            ? 'bg-green-900 text-green-300'
                            : char.status === 'dead'
                            ? 'bg-red-900 text-red-300'
                            : 'bg-yellow-900 text-yellow-300'
                        }`}
                      >
                        {char.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => openEdit(char)}
                        className="text-purple-400 hover:text-purple-300 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(char)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Character Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Character</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Character name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Class</label>
                <select
                  value={addForm.char_class}
                  onChange={(e) => setAddForm((f) => ({ ...f, char_class: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select class…</option>
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Level</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={addForm.level}
                    onChange={(e) => setAddForm((f) => ({ ...f, level: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max HP</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 52"
                    value={addForm.max_hp}
                    onChange={(e) => setAddForm((f) => ({ ...f, max_hp: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              {addError && <p className="text-red-400 text-sm">{addError}</p>}
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddForm(EMPTY_ADD_FORM); setAddError(null) }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
                >
                  {addLoading ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Character Modal */}
      {editingChar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit {editingChar.name}</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Class</label>
                <select
                  value={editForm.char_class}
                  onChange={(e) => setEditForm((f) => ({ ...f, char_class: e.target.value }))}
                  className={selectClass}
                >
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Level</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editForm.level}
                    onChange={(e) => setEditForm((f) => ({ ...f, level: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max HP</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.max_hp}
                    onChange={(e) => setEditForm((f) => ({ ...f, max_hp: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Current HP</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.current_hp}
                    onChange={(e) => setEditForm((f) => ({ ...f, current_hp: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {editError && <p className="text-red-400 text-sm">{editError}</p>}
              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setEditingChar(null); setEditError(null) }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
                >
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
