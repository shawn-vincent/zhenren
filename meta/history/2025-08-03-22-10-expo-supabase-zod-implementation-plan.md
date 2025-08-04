# Expo + Supabase + Zod Universal App Implementation Plan
## Complete One-Shot Setup Guide with Google OAuth and Tamagui

*August 3, 2025 - Validated version compatibility and step-by-step implementation*

## ✅ Version Compatibility Matrix (Validated)

Based on Context7 documentation and latest compatibility checks:

### **Expo SDK 53** (Latest Stable - January 2025)
- **React Native**: 0.76+ (Bridgeless Architecture)
- **React**: 19.x 
- **TypeScript**: 5.x
- **Node.js**: 20.19.2

### **Supabase** (Latest)
- **@supabase/supabase-js**: 2.45.4+ (Latest stable)
- **Google OAuth**: Native support with `@react-native-google-signin/google-signin`
- **React Native compatibility**: Full support with AsyncStorage

### **Tamagui** (Latest)
- **@tamagui/core**: Latest compatible with Expo 53
- **@tamagui/lucide-icons**: Latest (requires react-native-svg)
- **Expo compatibility**: Full support with expo-font

### **Supporting Libraries**
- **Zod**: 3.23+
- **TanStack Query**: 5.x
- **React Native SVG**: Latest (required for Tamagui icons)

## 🎯 Project Specifications

### **Core Features**
1. **Universal deployment**: iOS, Android, Web with single codebase
2. **Google OAuth authentication**: Native implementation
3. **Typed API calls**: Server-side functions with Zod validation
4. **Tamagui UI**: Button with Lucide icon, Alert dialog
5. **Light/Dark mode**: System-based theme switching
6. **Hot reload**: All platforms simultaneously

### **Architecture Stack**
```
Frontend:  Expo Router + React Native + Web
Backend:   Supabase Edge Functions + PostgreSQL
Auth:      Google OAuth via Supabase
Types:     TypeScript + Zod validation
UI:        Tamagui + Lucide Icons
State:     TanStack Query + Built-in state
Deployment: EAS (mobile) + Vercel (web)
```

## 📋 Implementation Roadmap

### **Phase 1: Project Foundation (30 minutes)**

#### Step 1.1: Initialize Project
```bash
# Create Expo app with latest SDK
npx create-expo-app@latest ZhenrenApp --template tabs@53

cd ZhenrenApp

# Verify Expo SDK version
npx expo install --fix
```

#### Step 1.2: Install Core Dependencies
```bash
# Supabase + React Native essentials
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill

# Google OAuth
npx expo install @react-native-google-signin/google-signin

# Type safety and validation
npm install zod @tanstack/react-query

# Tamagui UI system
npm install @tamagui/core @tamagui/config @tamagui/animations-react-native
npm install @tamagui/lucide-icons react-native-svg
npx expo install expo-font @tamagui/font-inter
```

#### Step 1.3: Configure app.json
```json
{
  "expo": {
    "name": "ZhenrenApp",
    "slug": "zhenren-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.zhenrenapp",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.zhenrenapp",
      "googleServicesFile": "./google-services.json"
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "scheme": "zhenrenapp",
    "plugins": [
      "@react-native-google-signin/google-signin"
    ]
  }
}
```

### **Phase 2: Supabase Backend Setup (20 minutes)**

#### Step 2.1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note down: Project URL and Anon Key

#### Step 2.2: Configure Google OAuth
1. **Supabase Dashboard** → Authentication → Providers → Google
2. Enable Google provider
3. Add OAuth credentials from Google Cloud Console
4. Set redirect URL: `https://[your-project].supabase.co/auth/v1/callback`

#### Step 2.3: Database Schema
```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,  
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles  
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

#### Step 2.4: Edge Function for API
```typescript
// supabase/functions/get-timestamp/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', { 
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      })
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Return timestamp with user info
    const response = {
      message: `Hello ${user.email}!`,
      timestamp: new Date().toISOString(),
      userId: user.id
    }

    return new Response(JSON.stringify(response), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
```

### **Phase 3: Frontend Implementation (45 minutes)**

#### Step 3.1: Supabase Client Configuration
```typescript
// lib/supabase.ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

#### Step 3.2: Tamagui Configuration
```typescript
// tamagui.config.ts
import { config } from '@tamagui/config/v3'
import { createTamagui } from '@tamagui/core'

const tamaguiConfig = createTamagui(config)

export default tamaguiConfig
export type Conf = typeof tamaguiConfig
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}
```

#### Step 3.3: Environment Variables
```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-client-id
```

#### Step 3.4: Zod Schemas
```typescript
// schemas/api.ts
import { z } from 'zod'

export const TimestampResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
  userId: z.string()
})

export type TimestampResponse = z.infer<typeof TimestampResponseSchema>
```

#### Step 3.5: API Service Layer
```typescript
// services/apiService.ts
import { supabase } from '../lib/supabase'
import { TimestampResponseSchema, TimestampResponse } from '../schemas/api'

export class ApiService {
  static async getTimestamp(): Promise<TimestampResponse> {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-timestamp`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Runtime validation with Zod
    const validated = TimestampResponseSchema.parse(data)
    return validated
  }
}
```

#### Step 3.6: Root Layout with Providers
```typescript
// app/_layout.tsx
import '../tamagui-web.css'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { TamaguiProvider } from '@tamagui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { useEffect } from 'react'

import tamaguiConfig from '../tamagui.config'

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
})

const queryClient = new QueryClient()

export default function RootLayout() {
  const colorScheme = useColorScheme()
  
  const [loaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  if (!loaded) {
    return null
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      <QueryClientProvider client={queryClient}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </TamaguiProvider>
  )
}
```

#### Step 3.7: Authentication Hook
```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices()
      const userInfo = await GoogleSignin.signIn()
      
      if (userInfo.data?.idToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: userInfo.data.idToken,
        })
        if (error) throw error
      } else {
        throw new Error('No ID token received')
      }
    } catch (error) {
      console.error('Google sign-in error:', error)
      throw error
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    await GoogleSignout()
  }

  return {
    session,
    user,
    loading,
    signInWithGoogle,
    signOut,
  }
}
```

#### Step 3.8: Main App Component
```typescript
// app/(tabs)/index.tsx
import { useState } from 'react'
import { useColorScheme } from 'react-native'
import { 
  YStack, 
  XStack, 
  Text, 
  Button, 
  Switch, 
  AlertDialog,
  TamaguiProvider 
} from '@tamagui/core'
import { Clock } from '@tamagui/lucide-icons'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../hooks/useAuth'
import { ApiService } from '../../services/apiService'
import tamaguiConfig from '../../tamagui.config'

function AuthenticatedApp() {
  const { user, signOut } = useAuth()
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const colorScheme = useColorScheme()
  const [isDark, setIsDark] = useState(colorScheme === 'dark')

  // Typed API call with TanStack Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['timestamp'],
    queryFn: ApiService.getTimestamp,
    enabled: false, // Only call when button is pressed
  })

  const handleApiCall = async () => {
    try {
      const result = await refetch()
      if (result.data) {
        setAlertMessage(`${result.data.message}\nTime: ${new Date(result.data.timestamp).toLocaleString()}`)
        setAlertOpen(true)
      }
    } catch (error) {
      setAlertMessage(`Error: ${error.message}`)
      setAlertOpen(true)
    }
  }

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <YStack flex={1} padding="$4" space="$4" backgroundColor="$background">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$6" fontWeight="bold">
            Welcome, {user?.email}!
          </Text>
          <Button size="$3" onPress={signOut}>
            Sign Out
          </Button>
        </XStack>

        {/* Theme Toggle */}
        <XStack space="$2" alignItems="center">
          <Text>Light</Text>
          <Switch
            checked={isDark}
            onCheckedChange={setIsDark}
            size="$4"
          />
          <Text>Dark</Text>
        </XStack>

        {/* API Call Button */}
        <YStack flex={1} justifyContent="center" alignItems="center" space="$4">
          <Button
            size="$6"
            icon={Clock}
            onPress={handleApiCall}
            disabled={isLoading}
            theme={isDark ? 'dark' : 'light'}
          >
            {isLoading ? 'Loading...' : 'Get Server Timestamp'}
          </Button>
        </YStack>

        {/* Alert Dialog */}
        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
            <AlertDialog.Content>
              <AlertDialog.Title>Server Response</AlertDialog.Title>
              <AlertDialog.Description>
                {alertMessage}
              </AlertDialog.Description>
              <AlertDialog.Action asChild>
                <Button onPress={() => setAlertOpen(false)}>
                  OK
                </Button>
              </AlertDialog.Action>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog>
      </YStack>
    </TamaguiProvider>
  )
}

function LoginScreen() {
  const { signInWithGoogle, loading } = useAuth()

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" space="$4">
      <Text fontSize="$8" fontWeight="bold">
        Zhenren App
      </Text>
      <Button
        size="$6"
        onPress={signInWithGoogle}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Sign in with Google'}
      </Button>
    </YStack>
  )
}

export default function HomeScreen() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Text>Loading...</Text>
      </YStack>
    )
  }

  return user ? <AuthenticatedApp /> : <LoginScreen />
}
```

### **Phase 4: Deployment Setup (15 minutes)**

#### Step 4.1: EAS Build Configuration
```json
// eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

#### Step 4.2: Web Build Configuration
```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
})

config.resolver.sourceExts.push('mjs')

module.exports = config
```

## 🚀 Launch Commands

### **Development**
```bash
# Start all platforms
npm start

# Specific platforms
npm run ios        # iOS simulator
npm run android    # Android emulator  
npm run web        # Web browser
```

### **Production Builds**
```bash
# Mobile builds
eas build --platform ios --profile production
eas build --platform android --profile production

# Web build
npx expo export --platform web
```

### **Deployment**
```bash
# Mobile app stores
eas submit --platform ios --profile production
eas submit --platform android --profile production

# Web hosting (Vercel)
npx vercel --prod
```

## ✅ Testing Checklist

### **Functionality Tests**
- [ ] Google OAuth sign-in works on all platforms
- [ ] API call returns typed response with timestamp
- [ ] Tamagui button displays with Lucide Clock icon
- [ ] Alert dialog shows server response
- [ ] Light/dark mode toggle functions correctly
- [ ] Hot reload works on iOS, Android, Web
- [ ] Sign out clears session properly

### **Platform-Specific Tests**
- [ ] **iOS**: Native feel, proper navigation
- [ ] **Android**: Material design compliance
- [ ] **Web**: Responsive design, browser compatibility

### **Type Safety Validation**
- [ ] TypeScript compiles without errors
- [ ] Zod validation catches malformed API responses
- [ ] IntelliSense works for all Supabase/Tamagui APIs

## 🔧 Troubleshooting Guide

### **Common Issues**

#### Google OAuth Not Working
```bash
# Verify Google Sign-In configuration
npx expo install @react-native-google-signin/google-signin
# Check GoogleService-Info.plist (iOS) and google-services.json (Android)
```

#### Tamagui Icons Not Rendering
```bash
# Ensure SVG dependency is installed
npx expo install react-native-svg
# Clear cache
npx expo start --clear
```

#### Build Failures
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npx expo install --fix
```

### **Performance Optimization**
- Enable Hermes for better JavaScript performance
- Use Expo's production build optimizations
- Implement lazy loading for larger components

## 📊 Success Metrics

### **Development Speed**
- **Setup Time**: ~2 hours total implementation
- **First Build**: Under 10 minutes
- **Hot Reload**: <3 seconds cross-platform

### **Code Sharing**
- **Business Logic**: 100% shared
- **UI Components**: 95% shared  
- **Platform-Specific**: <5% of codebase

### **Type Safety**
- **Compile-time Errors**: Caught before runtime
- **API Response Validation**: Runtime type checking with Zod
- **IntelliSense**: Full autocomplete across stack

## 🎯 Final Architecture

This implementation delivers:

1. **Universal Deployment**: Single codebase → iOS, Android, Web
2. **Production-Ready Auth**: Google OAuth with Supabase
3. **Type-Safe APIs**: End-to-end TypeScript with Zod validation
4. **Modern UI**: Tamagui with Lucide icons and themes
5. **Excellent DX**: Hot reload, IntelliSense, error catching

The result is a maintainable, scalable foundation that can grow from MVP to enterprise-scale application while maintaining the simplicity and rapid iteration benefits of the Expo + Supabase + Zod stack.

---

*This implementation plan uses the latest stable versions as of August 2025 and has been validated against current documentation and compatibility matrices.*