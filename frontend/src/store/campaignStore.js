import { create } from 'zustand'
import api from '../services/api'

const useCampaignStore = create((set) => ({
  campaigns: [],
  characters: [],

  fetchCampaigns: async () => {
    const { data } = await api.get('/campaigns')
    set({ campaigns: data })
  },

  createCampaign: async (name) => {
    const { data } = await api.post('/campaigns', { name })
    set((state) => ({ campaigns: [...state.campaigns, data] }))
    return data
  },

  fetchCharacters: async (campaignId) => {
    const { data } = await api.get(`/campaigns/${campaignId}/characters`)
    set({ characters: data })
  },

  addCharacter: async (campaignId, characterData) => {
    const { data } = await api.post(`/campaigns/${campaignId}/characters`, characterData)
    set((state) => ({ characters: [...state.characters, data] }))
    return data
  },

  updateCharacter: async (characterId, updates) => {
    const { data } = await api.patch(`/characters/${characterId}`, updates)
    set((state) => ({
      characters: state.characters.map((c) => (c.id === characterId ? data : c)),
    }))
    return data
  },

  deleteCharacter: async (characterId) => {
    await api.delete(`/characters/${characterId}`)
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== characterId),
    }))
  },
}))

export default useCampaignStore
