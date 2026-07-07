const auth = {
  async login(email, password) {
    const res = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Login failed");
    return json;
  },

  async signup(formData) {
    const body = {
      email: formData.email,
      password: formData.password,
      name: `${formData.firstName} ${formData.lastName}`,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone || undefined,
    };
    const res = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Signup failed");

    // After successful Better Auth signup, create role-specific profile
    try {
      await fetch("/api/register-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    } catch (profileErr) {
      console.error("Profile creation error (user was still created):", profileErr);
    }

    return json;
  },

  async logout() {
    await fetch("/api/auth/sign-out", { method: "POST" });
  },

  async getCurrentUser() {
    const res = await fetch("/api/auth/get-session");
    const json = await res.json();
    if (!res.ok || !json) return null;
    return json.user || null;
  },

  async getDashboard() {
    const res = await fetch("/api/dashboard");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load dashboard");
    return json;
  },

  async forgotPassword(email) {
    const res = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  },

  async resetPassword(token, newPassword) {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    return await res.json();
  },

  async verifyEmail(token) {
    const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
    return await res.json();
  },

  isAuthenticated() {
    return document.cookie.includes("session_token=");
  },
};
