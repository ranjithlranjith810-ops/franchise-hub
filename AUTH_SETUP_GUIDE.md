# FranchiseHub Authentication System - Setup Guide

## 📋 Overview

A complete authentication system with:
- ✅ User signup with role selection (Franchisor, Broker, Franchisee)
- ✅ Secure login with password hashing
- ✅ JWT token-based authentication
- ✅ Role-specific profile data storage
- ✅ Full Prisma ORM integration with Neon database
- ✅ Password change functionality
- ✅ Profile updates
- ✅ Session management

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd d:\JS TUTORIAL\franchise
npm install
```

This installs:
- `express` - Backend server
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `cors` - Cross-origin requests
- `dotenv` - Environment variables
- `@prisma/client` - Database ORM

### 2. Start the Server

```bash
npm run dev
```

Or for production:
```bash
npm start
```

The server will run on: `http://localhost:3001`

### 3. Open in Browser

Open `auth.html` in your browser or use a local server:

```bash
# Using Python
python -m http.server 3000

# Or using Node
npx serve .
```

Then visit: `http://localhost:3000/auth.html`

---

## 📁 Project Structure

```
franchise/
├── server/
│   ├── index.js              # Express server setup
│   └── auth.js               # Authentication routes & logic
├── js/
│   └── auth-client.js        # Frontend API client
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── auth.html                 # Authentication UI
├── .env                      # Environment variables
├── package.json              # Dependencies
└── prisma.config.ts          # Prisma configuration
```

---

## 🔐 Authentication Flows

### SIGNUP Flow

```
User fills form → Select role → Submit
    ↓
auth.signup() called with form data
    ↓
Server validates & creates:
  - User in `users` table
  - User role in `user_roles` table
  - Role-specific profile:
    * Franchisor: organization + org members
    * Broker: broker_profile
    * Franchisee: franchisee_profile
    ↓
JWT token generated & stored
    ↓
User redirected to dashboard
```

### LOGIN Flow

```
User enters email/password → Submit
    ↓
auth.login() called
    ↓
Server validates credentials
    ↓
Password verified with bcrypt
    ↓
JWT token generated
    ↓
User data & token stored locally
    ↓
User redirected to dashboard
```

---

## 🗄️ Database Schema - Auth Tables

### `users` table
- `id` - UUID primary key
- `email` - Unique email (case-insensitive)
- `passwordHash` - Bcrypt hashed password
- `firstName, lastName` - User name
- `phone` - Contact number
- `city, stateProvince, countryCode` - Location
- `isActive` - Account status
- `lastLoginAt` - Last login timestamp
- `createdAt, updatedAt` - Timestamps

### `user_roles` table
- `id` - UUID
- `userId` - Foreign key to users
- `role` - Enum: franchisor, broker, franchisee, admin
- `isPrimary` - Primary role flag
- `createdAt` - Timestamp

### Role-Specific Tables

#### `franchisee_profiles`
- `userId` - Foreign key (PK)
- `investmentCapacityMin/Max` - Investment range
- `liquidCapital, netWorth` - Financial info
- `timeline` - Purchase timeline
- `experienceBackground` - Background

#### `broker_profiles`
- `userId` - Foreign key (PK)
- `licenseNumber, licenseState` - License info
- `yearsExperience` - Experience years
- `bio` - Professional bio

#### `organization_members` (for Franchisor)
- Stored as org members with owner role
- Links user to their organization

---

## 🛡️ Security Features

### Password Security
- ✅ Bcrypt hashing (10 salt rounds)
- ✅ Never stored in plain text
- ✅ Validated on login

### Token Security
- ✅ JWT tokens with 7-day expiration
- ✅ Token stored in localStorage
- ✅ Bearer token in Authorization header
- ✅ Server-side token verification

### Data Validation
- ✅ Email uniqueness check
- ✅ Password confirmation validation
- ✅ Required field validation
- ✅ Input sanitization

---

## 📡 API Endpoints

### POST /api/auth/signup
Create a new user account

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePass123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+919876543210",
  "location": "Mumbai, Maharashtra, India",
  "role": "franchisor",
  "companyName": "McDonald's Franchise",
  "website": "https://mcdonalds.com",
  "title": "CEO"
}
```

**Response:**
```json
{
  "message": "Franchisor account created successfully",
  "user": {
    "id": "uuid-xxx",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "franchisor",
    "organizationId": "uuid-org"
  },
  "token": "eyJhbGc..."
}
```

---

### POST /api/auth/login
Authenticate and get JWT token

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePass123",
  "rememberMe": true
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-xxx",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "franchisor"
  },
  "token": "eyJhbGc...",
  "rememberMe": true
}
```

---

### GET /api/auth/me
Get current user info (requires token)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid-xxx",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "franchisor"
  }
}
```

---

### PUT /api/auth/profile
Update user profile (requires token)

**Request:**
```json
{
  "firstName": "Jonathan",
  "bio": "Franchise CEO",
  "city": "Mumbai"
}
```

---

### POST /api/auth/change-password
Change user password (requires token)

**Request:**
```json
{
  "currentPassword": "oldPass123",
  "newPassword": "newPass456"
}
```

---

### POST /api/auth/logout
Logout user (client-side)

---

## 🧪 Testing the System

### Test Signup - Franchisor

1. Open auth.html
2. Click "Sign up" tab
3. Select "Franchisor" role
4. Fill in:
   - First name: John
   - Last name: Doe
   - Email: john@franchisehub.com
   - Password: SecurePass123
   - Confirm: SecurePass123
   - Location: Mumbai, Maharashtra, India
   - Company: McDonald's
   - Website: https://mcdonalds.com
   - Title: CEO
5. Click "Create account"
6. Check Neon database - should see:
   - New user in `users` table
   - New role in `user_roles` table
   - New organization in `organizations` table
   - New member in `organization_members` table

### Test Signup - Broker

1. Select "Broker" role
2. Fill broker-specific fields:
   - Brokerage: Elite Brokers Inc
   - License: BR-12345
   - License State: Maharashtra
   - Experience: 5 years
3. Submit and verify `broker_profiles` table

### Test Signup - Franchisee

1. Select "Franchisee" role
2. Fill franchisee-specific fields:
   - Investment Min: ₹10L
   - Investment Max: ₹60L
   - Liquid Capital: ₹20L
   - Timeline: Within 6 months
3. Submit and verify `franchisee_profiles` table

### Test Login

1. Click "Login" tab
2. Use created account:
   - Email: john@franchisehub.com
   - Password: SecurePass123
3. Check Remember me box
4. Click "Continue"
5. Should redirect to landing page
6. Check localStorage for stored token and user data

---

## 🐛 Debugging

### Check Server Logs
```
✓ FranchiseHub Auth Server running on http://localhost:3001
✓ API endpoints available at http://localhost:3001/api
```

### Check Database
```bash
npm run prisma:studio
```
Opens Prisma Studio at `http://localhost:5555`

### Check Browser Console
- F12 → Console tab
- Look for auth-related logs
- Check network tab for API calls

### Common Issues

| Issue | Solution |
|-------|----------|
| "Can't reach database" | Ensure `.env` DATABASE_URL is correct |
| CORS errors | Check server CORS config |
| Token expired | Login again, tokens expire in 7 days |
| Password mismatch | Confirm passwords match in signup |
| Email exists | Use different email or reset database |

---

## 📊 Viewing Data

### In Prisma Studio
```bash
npm run prisma:studio
```
Then browse tables visually

### In Neon Console
1. Go to https://console.neon.tech
2. Select your project
3. Click "Tables" to browse schema
4. SQL Editor for custom queries

### Sample Query - Get All Users
```sql
SELECT id, email, "firstName", "lastName", "createdAt", "lastLoginAt"
FROM users
ORDER BY "createdAt" DESC;
```

### Sample Query - Get User with Role
```sql
SELECT 
  u.email, 
  u."firstName",
  ur.role,
  u."createdAt"
FROM users u
LEFT JOIN user_roles ur ON u.id = ur."userId"
WHERE ur."isPrimary" = true;
```

---

## 🔄 Frontend Functions

All available in `js/auth-client.js`:

### auth.login(email, password, rememberMe)
```javascript
await auth.login("john@example.com", "password", true);
```

### auth.signup(formData)
```javascript
await auth.signup({
  email: "john@example.com",
  password: "password",
  firstName: "John",
  // ... other fields
});
```

### auth.getCurrentUser()
```javascript
const user = await auth.getCurrentUser();
```

### auth.updateProfile(data)
```javascript
await auth.updateProfile({ firstName: "Jonathan" });
```

### auth.changePassword(currentPwd, newPwd)
```javascript
await auth.changePassword("oldPass", "newPass");
```

### auth.logout()
```javascript
auth.logout(); // Clears localStorage
```

### auth.isAuthenticated()
```javascript
if (auth.isAuthenticated()) {
  console.log("User is logged in");
}
```

---

## 📝 Next Steps

1. ✅ Test all signup roles
2. ✅ Test login functionality
3. ✅ Verify data in database
4. ✅ Create dashboard page
5. ✅ Add profile edit functionality
6. ✅ Add password change form
7. ✅ Create role-based views
8. ✅ Add email verification
9. ✅ Add password reset
10. ✅ Deploy to production

---

## 🚀 Production Deployment

### Update Environment Variables
```bash
# Change JWT_SECRET
JWT_SECRET="your-production-secret-key"

# Update CORS_ORIGIN
CORS_ORIGIN=https://yourdomain.com

# Set NODE_ENV
NODE_ENV=production

# Update database for production
DATABASE_URL="your-production-db-url"
```

### Security Checklist
- ✅ Change JWT_SECRET
- ✅ Enable HTTPS
- ✅ Set secure cookies
- ✅ Add rate limiting
- ✅ Add email verification
- ✅ Add password reset flow
- ✅ Implement refresh tokens
- ✅ Add audit logging

---

## 📞 Support

For issues or questions:
1. Check browser console (F12)
2. Check server logs
3. Verify Neon database connection
4. Review Prisma Studio data

---

**Happy Franchising! 🎉**
