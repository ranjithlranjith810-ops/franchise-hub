# ⚡ FranchiseHub Auth - Quick Reference Card

## 🚀 Get Started in 3 Steps

### Step 1: Start Server
```bash
cd "d:\JS TUTORIAL\franchise"
npm run dev
```

**Expected Output:**
```
✓ FranchiseHub Auth Server running on http://localhost:3001
✓ API endpoints available at http://localhost:3001/api
```

### Step 2: Start Web Server (New Terminal)
```bash
npx serve .
```

**Expected Output:**
```
  Accepting connections at http://localhost:3000
```

### Step 3: Open in Browser
```
http://localhost:3000/auth.html
```

---

## 📋 Testing Checklist

| # | Test | Expected Result | Verify In |
|---|------|-----------------|-----------|
| 1 | Signup → Franchisor | User + Org created | Prisma Studio → organizations |
| 2 | Signup → Broker | User + License saved | Prisma Studio → broker_profiles |
| 3 | Signup → Franchisee | User + Investment saved | Prisma Studio → franchisee_profiles |
| 4 | Login → Email + Password | Token generated | Browser localStorage |
| 5 | Remember Me | localStorage persists | Browser DevTools → Application |
| 6 | Create 2nd Account | Different email | Prisma Studio → users table |

---

## 💻 Common Commands

```bash
# Development
npm run dev                    # Start server with auto-reload
npm start                      # Start server (production)

# Database
npm run prisma:studio          # Open visual database browser
npm run prisma:migrate         # Run migrations
npm run prisma:reset           # Reset database (dev only!)

# Testing
node server/test-auth.js       # Run test suite
curl http://localhost:3001/api/health  # Check server status
```

---

## 🗂️ Key Files

| File | Purpose | Edit? |
|------|---------|-------|
| `server/index.js` | Server setup | No |
| `server/auth.js` | Auth routes | Customize |
| `js/auth-client.js` | Frontend API | Extend |
| `auth.html` | Login/Signup UI | Customize |
| `.env` | Configuration | Edit with values |
| `prisma/schema.prisma` | Database schema | Extend |

---

## 🔐 Test Accounts

**After Signup, Test Login With:**

### Franchisor
```
Email: your-email@test.com
Password: (whatever you entered)
```

### Broker
```
Email: broker@test.com
Password: (whatever you entered)
```

### Franchisee
```
Email: franchisee@test.com
Password: (whatever you entered)
```

---

## 📊 Database Tables (Auth-Related)

```
users
├── id, email, firstName, lastName, passwordHash
├── lastLoginAt, createdAt, updatedAt
└── Relationships: user_roles, profiles, etc.

user_roles
├── userId, role (franchisor/broker/franchisee)
└── isPrimary

franchisee_profiles
├── userId, investmentCapacityMin, investmentCapacityMax
├── liquidCapital, netWorth, timeline
└── experienceBackground

broker_profiles
├── userId, licenseNumber, licenseState
├── yearsExperience, bio
└── Relationships: broker_representations

organizations
├── id, name, orgType (franchisor/brokerage)
├── createdBy (userId), createdAt
└── Relationships: organization_members

organization_members
├── organizationId, userId, memberRole (owner/admin/member)
└── isPrimaryContact
```

---

## 🌐 API Quick Reference

### POST /api/auth/signup
**What it does:** Create new user account
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@test.com",
    "password": "Test123456",
    "firstName": "John",
    "lastName": "Doe",
    "role": "franchisor",
    "companyName": "My Company"
  }'
```

**Returns:** User object + JWT token

---

### POST /api/auth/login
**What it does:** Authenticate user
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@test.com",
    "password": "Test123456",
    "rememberMe": true
  }'
```

**Returns:** User object + JWT token

---

### GET /api/auth/me
**What it does:** Get current logged-in user
```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <token>"
```

**Returns:** User object

---

### PUT /api/auth/profile
**What it does:** Update user profile
```bash
curl -X PUT http://localhost:3001/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "firstName": "Jonathan",
    "bio": "CEO of Company"
  }'
```

---

### POST /api/auth/change-password
**What it does:** Change password
```bash
curl -X POST http://localhost:3001/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "currentPassword": "OldPass123",
    "newPassword": "NewPass456"
  }'
```

---

## 🧠 Frontend JavaScript Usage

```javascript
// ===== SIGNUP =====
const result = await auth.signup({
  email: "john@test.com",
  password: "Test123456",
  firstName: "John",
  lastName: "Doe",
  role: "franchisor",
  companyName: "My Company"
});
console.log(result.user.id);    // Get user ID
console.log(result.token);       // Get JWT token

// ===== LOGIN =====
const result = await auth.login("john@test.com", "Test123456", true);
console.log(result.user);        // User object
console.log(result.token);       // JWT token

// ===== GET CURRENT USER =====
const user = await auth.getCurrentUser();
if (user) {
  console.log(user.firstName);   // John
  console.log(user.email);       // john@test.com
  console.log(user.role);        // franchisor
}

// ===== UPDATE PROFILE =====
await auth.updateProfile({
  firstName: "Jonathan",
  bio: "CEO"
});

// ===== CHANGE PASSWORD =====
await auth.changePassword("oldPass", "newPass");

// ===== CHECK IF LOGGED IN =====
if (auth.isAuthenticated()) {
  console.log("User is logged in");
}

// ===== LOGOUT =====
auth.logout();
```

---

## 🔍 Debugging Shortcuts

| Need to... | Command | Where |
|------------|---------|-------|
| See all users | `npm run prisma:studio` | Browser → users table |
| Check server | `curl http://localhost:3001/api/health` | Terminal |
| Run tests | `node server/test-auth.js` | Terminal |
| See database | `npm run prisma:studio` | Browser port 5555 |
| Check token | Open DevTools → Application → localStorage | Browser |
| Reset DB | `npm run prisma:reset` | Terminal (WARNING!) |

---

## ⚠️ Common Issues & Quick Fixes

| Problem | Fix |
|---------|-----|
| "Can't reach database" | Check `.env` DATABASE_URL |
| "Port 3001 in use" | Kill process: `lsof -i :3001` |
| "CORS error" | Make sure server is running on 3001 |
| "Module not found" | Run `npm install` again |
| "Email already exists" | Use different email or reset DB |
| "Invalid token" | Login again, token might be expired |

---

## 📱 Browser Testing Tips

### Open DevTools
Press: **F12**

### Check localStorage
- DevTools → Application → Storage → localStorage
- Should see: `authToken` and `user`

### Check Network
- DevTools → Network tab
- Make request (login/signup)
- Check request/response in Network tab

### Check Console
- DevTools → Console tab
- Look for errors (red text)
- Auth messages logged as info (gray text)

---

## 🎯 Success Indicators

✅ **After Signup:**
- Success message in browser
- User in Prisma Studio → users table
- Role in Prisma Studio → user_roles table
- lastLoginAt timestamp updated

✅ **After Login:**
- Redirected to dashboard
- localStorage has `authToken`
- localStorage has `user` object
- `lastLoginAt` updated in database

✅ **System Working:**
- Server running on port 3001
- Web server on port 3000
- Both terminals show no errors
- Prisma Studio accessible
- Test script shows user counts

---

## 📞 Need Help?

1. **Check server logs** - Terminal where you ran `npm run dev`
2. **Check browser console** - F12 → Console
3. **Test script** - `node server/test-auth.js`
4. **View database** - `npm run prisma:studio`
5. **Reset and try again** - `npm run prisma:reset` (careful!)

---

## 🚀 You're Ready!

```bash
npm run dev
```

Then open: http://localhost:3000/auth.html

**Let's go! 🎉**
