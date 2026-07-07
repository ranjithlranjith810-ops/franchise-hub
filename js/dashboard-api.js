const api = {
  async request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || json.error || 'Request failed');
    return json;
  },

  async getDashboard() {
    return this.request('/api/dashboard');
  },

  async searchListings(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const str = qs.toString();
    return this.request(`/api/listings/search${str ? '?' + str : ''}`);
  },

  async getListingDetail(id) {
    return this.request(`/api/listings/${id}`);
  },

  async requestInfo(listingId, notes) {
    return this.request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({ listingId, notes }),
    });
  },

  async getSaved() {
    return this.request('/api/saved');
  },

  async toggleSave(listingId) {
    return this.request('/api/saved', {
      method: 'POST',
      body: JSON.stringify({ listingId }),
    });
  },

  async getPipeline() {
    return this.request('/api/pipeline');
  },

  async getBrands() {
    return this.request('/api/brands');
  },

  async createBrand(data) {
    return this.request('/api/brands', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getBrandDetail(id) {
    return this.request(`/api/brands/${id}`);
  },

  async updateBrand(id, data) {
    return this.request(`/api/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateBrandStatus(id, status) {
    return this.request(`/api/brands/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async getBrandListings(id) {
    return this.request(`/api/brands/${id}/listings`);
  },

  async createListing(data) {
    return this.request('/api/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateListing(id, data) {
    return this.request(`/api/listings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getDeals(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const str = qs.toString();
    return this.request(`/api/deals${str ? '?' + str : ''}`);
  },

  async updateDealStage(id, stage, notes) {
    return this.request(`/api/deals/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, notes }),
    });
  },

  async getConnections() {
    return this.request('/api/connections');
  },

  async requestConnection(userId) {
    return this.request('/api/connections/request', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async respondConnection(id, status) {
    return this.request(`/api/connections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async getConversations() {
    return this.request('/api/conversations');
  },

  async getMessages(conversationId, page = 1, limit = 50) {
    const qs = new URLSearchParams({ page, limit });
    return this.request(`/api/conversations/${conversationId}/messages?${qs}`);
  },

  async sendMessage(conversationId, content) {
    return this.request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async startConversation(participantId, content) {
    return this.request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantId, content }),
    });
  },

  async getProfile() {
    return this.request('/api/profile');
  },

  async updateProfile(data) {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getNotifications() {
    return this.request('/api/notifications');
  },

  async markNotificationsRead(ids) {
    return this.request('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async getOrg() {
    return this.request('/api/org');
  },

  async updateOrg(data) {
    return this.request('/api/org', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async inviteOrgMember(email, memberRole) {
    return this.request('/api/org/members', {
      method: 'POST',
      body: JSON.stringify({ email, memberRole }),
    });
  },
};
