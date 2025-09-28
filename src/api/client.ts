const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }

    return data.data;
  }

  // Board operations
  async getListsByBoard(boardId: string) {
    return this.request(`/boards/${boardId}/lists`);
  }

  async saveKanbanData(boardId: string, lists: any[]) {
    return this.request(`/boards/${boardId}/lists`, {
      method: 'POST',
      body: JSON.stringify({ lists }),
    });
  }

  // Card operations
  async createCard(cardData: any) {
    return this.request('/cards', {
      method: 'POST',
      body: JSON.stringify(cardData),
    });
  }

  async updateCard(cardId: string, updates: any) {
    return this.request(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteCard(cardId: string) {
    return this.request(`/cards/${cardId}`, {
      method: 'DELETE',
    });
  }

  async updateCardsPositions(cards: Array<{ id: string; list_id?: string; position: number }>) {
    return this.request('/cards/positions', {
      method: 'PUT',
      body: JSON.stringify({ cards }),
    });
  }

  // Card actions operations
  async createCardAction(actionData: any) {
    const result = await this.request('/card-actions', {
      method: 'POST',
      body: JSON.stringify(actionData),
    });
    return result;
  }

  async getCardActions(cardId: string) {
    const result = await this.request(`/cards/${cardId}/actions`);
    return result;
  }

  async deleteCardAction(actionId: string) {
    return this.request(`/card-actions/${actionId}`, {
      method: 'DELETE',
    });
  }

  // List operations
  async createList(listData: any) {
    return this.request('/lists', {
      method: 'POST',
      body: JSON.stringify(listData),
    });
  }

  async updateList(listId: string, updates: any) {
    return this.request(`/lists/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteList(listId: string) {
    return this.request(`/lists/${listId}`, {
      method: 'DELETE',
    });
  }

  async updateListsPositions(lists: Array<{ id: string; position: number }>) {
    return this.request('/lists/positions', {
      method: 'PUT',
      body: JSON.stringify({ lists }),
    });
  }

  // Settings operations
  async getSetting(key: string) {
    return this.request(`/settings/${key}`);
  }

  async setSetting(key: string, value: string) {
    return this.request('/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  }

  async getAllSettings() {
    return this.request('/settings');
  }

  // User operations
  async getUser(userId: string) {
    return this.request(`/users/${userId}`);
  }

  async getUserByDiscordId(discordId: string) {
    return this.request(`/users/discord/${discordId}`);
  }

  async createUser(userData: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, updates: any) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getAllUsers() {
    return this.request('/users');
  }

  async getDiscordStaffMembers() {
    return this.request('/discord/staff-members');
  }

  async getCachedStaffMembers() {
    return this.request('/cached-staff');
  }

  async updateUserActivity(discordId: string) {
    return this.request('/users/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ discordId }),
    });
  }

  async refreshCachedStaff() {
    return this.request('/cached-staff/refresh', {
      method: 'POST'
    });
  }

  // Migration operations
  async migrate() {
    return this.request('/migrate', {
      method: 'POST',
    });
  }

  async getMigrationStatus() {
    return this.request('/migration/status');
  }

  // Comments operations
  async getCardComments(cardId: string) {
    const result = await this.request(`/cards/${cardId}/comments`);
    return result;
  }

  async createCardComment(commentData: any) {
    const result = await this.request('/comments', {
      method: 'POST',
      body: JSON.stringify(commentData),
    });
    return result;
  }

  async deleteCardComment(commentId: string) {
    const result = await this.request(`/comments/${commentId}`, {
      method: 'DELETE',
    });
    return result;
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();