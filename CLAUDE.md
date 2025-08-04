# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a universal React Native application built with Expo SDK 53 that targets iOS, Android, and web platforms from a single codebase. The project combines **Tamagui** for performant cross-platform UI components and **NativeWind** for Tailwind CSS utilities in React Native.

## Development Commands

```bash
# Start development server with platform selection
npm start                 # Expo development server with QR code
npm run android          # Launch on Android device/emulator
npm run ios             # Launch on iOS simulator
npm run web             # Launch web version at localhost:8081

# Linting and code quality
npm run lint            # Run Expo's ESLint configuration

# Project management
npm run reset-project   # Move current app to app-example and create blank app directory
```

## UI Framework Architecture

This project uses a **dual UI approach** combining two complementary styling systems:

### Tamagui Components
- **Location**: Import from `tamagui` (e.g., `View`, `Text`, `Button`, `YStack`, `Card`)
- **Icons**: Import from `@tamagui/lucide-icons`
- **Styling**: Uses Tamagui's design tokens (`$red10`, `$gray12`) and props (`fontSize`, `fontWeight`)
- **Configuration**: `tamagui.config.ts` exports the design system configuration

### NativeWind Utilities  
- **Usage**: Apply via `className` prop with Tailwind CSS classes
- **Configuration**: `tailwind.config.js` with NativeWind preset
- **CSS**: `global.css` imports Tailwind base, components, and utilities

### Styling Best Practices
- **Mix both systems**: Tamagui props for component-level styling, NativeWind classes for layout and spacing
- **Example**: `<View className="flex-1 bg-gray-50 p-4"><Text fontSize={18} color="$gray12">Title</Text></View>`

## Critical Configuration Files

### babel.config.js
**IMPORTANT**: NativeWind must be in `presets`, not `plugins` for Expo SDK 53 compatibility:
```javascript
presets: [
  ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
  'nativewind/babel', // Must be in presets, not plugins
]
```

### metro.config.js
Configured with NativeWind integration and CSS support:
```javascript
module.exports = withNativeWind(config, { input: './global.css' });
```

### App Provider Structure
The root layout (`app/_layout.tsx`) wraps the app with both providers:
1. `TamaguiProvider` (outer) - provides Tamagui design system
2. `ThemeProvider` (inner) - provides React Navigation theming
3. Imports both `global.css` and `tamagui-web.css`

## File-Based Routing

Uses Expo Router with the following structure:
- `app/_layout.tsx` - Root layout with providers
- `app/(tabs)/` - Tab navigation group
- `app/(tabs)/_layout.tsx` - Tab layout configuration
- `app/(tabs)/index.tsx` - Home tab screen
- `app/(tabs)/explore.tsx` - Explore tab screen
- `app/+not-found.tsx` - 404 page

## Package Version Constraints

**Critical**: These specific versions are required for Expo SDK 53 compatibility:
- `expo: ~53.0.20`
- `react-native: 0.79.5`
- `react-native-reanimated: ~3.17.4`
- `nativewind: ^4.1.23`
- `tamagui: ^1.132.15`

## Common Issues & Solutions

### Babel Configuration Errors
If you see `.plugins is not a valid Plugin property`, ensure NativeWind is in the `presets` array, not `plugins`.

### Tamagui Config Loading
If Tamagui shows "empty/proxied config" errors, verify:
1. `tamagui.config.ts` imports from `@tamagui/config` (not `@tamagui/config/v4`)
2. Babel plugin points to correct config file: `config: './tamagui.config.ts'`

### Cache Issues
Always start with cache clearing for configuration changes:
```bash
npx expo start -c
```

## Platform-Specific Considerations

- **Web**: Automatically supported via React Native for Web
- **Mobile**: Uses native components via React Native
- **Styling**: Both Tamagui and NativeWind work across all platforms
- **Icons**: Tamagui Lucide icons render appropriately on each platform
- **Navigation**: Expo Router handles both web URLs and native navigation

## TypeScript Configuration

The project uses TypeScript with Expo's configuration. Tamagui types are extended via module declaration in `tamagui.config.ts`.