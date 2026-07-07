#!/bin/bash
# FranchiseHub Auth System - Setup Verification Checklist
# Run this to verify everything is installed correctly

echo "🔍 FranchiseHub Authentication System - Setup Verification"
echo "==========================================================="
echo ""

# Check Node.js
echo "1️⃣  Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js $NODE_VERSION is installed"
else
    echo "   ❌ Node.js not found - Please install Node.js from https://nodejs.org"
    exit 1
fi

# Check npm
echo ""
echo "2️⃣  Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   ✅ npm $NPM_VERSION is installed"
else
    echo "   ❌ npm not found"
    exit 1
fi

# Check required files
echo ""
echo "3️⃣  Checking required files..."

REQUIRED_FILES=(
    "package.json"
    "auth.html"
    ".env"
    "server/index.js"
    "server/auth.js"
    "js/auth-client.js"
    "prisma/schema.prisma"
    "prisma.config.ts"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file - MISSING!"
    fi
done

# Check node_modules
echo ""
echo "4️⃣  Checking dependencies..."
REQUIRED_PACKAGES=(
    "express"
    "bcryptjs"
    "jsonwebtoken"
    "cors"
    "dotenv"
    "@prisma/client"
)

for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if [ -d "node_modules/$pkg" ]; then
        echo "   ✅ $pkg"
    else
        echo "   ❌ $pkg - NOT INSTALLED! Run: npm install"
    fi
done

# Check .env configuration
echo ""
echo "5️⃣  Checking .env configuration..."
if grep -q "DATABASE_URL" .env; then
    echo "   ✅ DATABASE_URL configured"
else
    echo "   ❌ DATABASE_URL not found in .env"
fi

if grep -q "JWT_SECRET" .env; then
    echo "   ✅ JWT_SECRET configured"
else
    echo "   ❌ JWT_SECRET not found in .env"
fi

if grep -q "PORT" .env; then
    echo "   ✅ PORT configured"
else
    echo "   ❌ PORT not found in .env"
fi

# Summary
echo ""
echo "==========================================================="
echo "✅ Verification Complete!"
echo ""
echo "📋 Quick Start Commands:"
echo ""
echo "1. Start the server:"
echo "   npm run dev"
echo ""
echo "2. In another terminal, serve the files:"
echo "   npx serve ."
echo ""
echo "3. Open in browser:"
echo "   http://localhost:3000/auth.html"
echo ""
echo "4. Test the database:"
echo "   node server/test-auth.js"
echo ""
echo "==========================================================="
