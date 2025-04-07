const { createApp } = Vue;

createApp({
    data() {
        return {
            players: [
                { playerName: 'Alice', characterName: 'Elara', maxHps: 30, currentHps: 30, initiative: 15, damage: [], healing: [] },
                { playerName: 'Bob', characterName: 'Grimfang', maxHps: 45, currentHps: 45, initiative: 10, damage: [], healing: [] },
                { playerName: 'Charlie', characterName: 'Zephyr', maxHps: 25, currentHps: 25, initiative: 20, damage: [], healing: [] },
                // ... more players
            ],
            showPlayerModal: false,
            editingPlayer: null,
            newPlayer: { playerName: '', characterName: '', maxHps: null, currentHps: null, initiative: null },
            currentPlayerIndex: null,
            currentTurnActions: {
                attacks: [{ target: '', roll: null, damage: null, damageType: '', notes: '' }],
                movement: '',
                otherActions: ''
            }
        };
    },
    computed: {
        sortedPlayers() {
            return [...this.players].sort((a, b) => b.initiative - a.initiative);
        },
        currentPlayer() {
            if (this.currentPlayerIndex !== null && this.currentPlayerIndex < this.players.length) {
                return this.sortedPlayers[this.currentPlayerIndex];
            }

            return null;
        }
    },
    methods: {
        openPlayerModal(playerToEdit = null) {
            this.showPlayerModal = true;
            if (playerToEdit) {
                this.editingPlayer = playerToEdit;
                this.newPlayer = { ...playerToEdit }; // Create a copy to avoid direct modification
            } else {
                this.editingPlayer = null;
                this.resetNewPlayerForm();
            }
        },
        closePlayerModal() {
            this.showPlayerModal = false;
            this.resetNewPlayerForm();
            this.editingPlayer = null;
        },
        savePlayer() {
            if (this.editingPlayer) {
                // Find the index of the player to edit in the original 'players' array
                const index = this.players.findIndex(p => p.playerName === this.editingPlayer.playerName && p.characterName === this.editingPlayer.characterName);
                if (index !== -1) {
                    this.players[index] = { ...this.newPlayer };
                }
            } else {
                this.players.push({ ...this.newPlayer, damage: [], healing: [] });
            }
            this.closePlayerModal();
        },
        resetNewPlayerForm() {
            this.newPlayer = { playerName: '', characterName: '', maxHps: null, currentHps: null, initiative: null };
        },
        sortPlayersByInitiative() {
            this.players.sort((a, b) => b.initiative - a.initiative);
            this.currentPlayerIndex = 0; // Reset current turn after sorting
        },
        nextTurn() {
            if (this.sortedPlayers.length > 0) {
                if (this.currentPlayerIndex === null) {
                    this.currentPlayerIndex = 0;
                } else {
                    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.sortedPlayers.length;
                }
                // Optionally, save the actions taken in the previous turn here
                this.resetCurrentTurnActions();
            }
        },
        prevPlayer() {
            if (this.sortedPlayers.length > 0) {
                if (this.currentPlayerIndex === null) {
                    this.currentPlayerIndex = this.sortedPlayers.length - 1;
                } else {
                    this.currentPlayerIndex = (this.currentPlayerIndex - 1 + this.sortedPlayers.length) % this.sortedPlayers.length;
                }
            }
        },
        addAction(type) {
            if (type === 'attacks') {
                this.currentTurnActions.attacks.push({ target: '', roll: null, damage: null, damageType: '', notes: '' });
            }
            // Add more logic for other action types if needed
        },
        removeAction(type, index) {
            if (type === 'attacks') {
                this.currentTurnActions.attacks.splice(index, 1);
            }
            // Add more logic for other action types if needed
        },
        resetCurrentTurnActions() {
            this.currentTurnActions = {
                attacks: [{ target: '', roll: null, damage: null, damageType: '', notes: '' }],
                movement: '',
                otherActions: ''
            };
        },
        saveDataToFile() {
            const data = JSON.stringify(this.players, null, 2);
            const filename = 'combat_data.json';
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
}).mount('#app');