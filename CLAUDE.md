# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a universal React Native application built with Expo SDK 53 that targets iOS, Android, web, and desktop (Electron) platforms from a single codebase. The project combines **Tamagui** for performant cross-platform UI components and **NativeWind** for Tailwind CSS utilities in React Native. It includes a complete theming system with light/dark mode support.

## Development Commands

```bash
# Development servers
npm start                # Expo development server with QR code
npm run android          # Launch on Android device/emulator
npm run ios              # Launch on iOS simulator  
npm run web              # Launch web version at localhost:8081
npm run electron         # Launch Electron desktop app
npm run electron-dev     # Launch Electron in development mode

# Code quality and linting
npm run typecheck        # TypeScript type checking
npm run lint             # Biome linting with auto-fix
npm run lint:biome       # Biome linting only
npm run lint:expo        # Expo ESLint configuration
npm run format           # Biome code formatting
npm run check            # Run all checks (typecheck + lint)

# Production builds
npm run build            # Build all platforms (iOS, Android, Web)
npm run build:ios        # Build iOS using EAS (requires EAS CLI)
npm run build:android    # Build Android using EAS (requires EAS CLI)  
npm run build:web        # Build web version
npm run build:electron   # Build Electron desktop app
npm run build:osx        # Build macOS desktop app
npm run build:windows    # Build Windows desktop app
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
1. `ThemeProvider` (outer) - provides custom theme context with light/dark mode
2. `TamaguiProvider` (inner) - provides Tamagui design system, configured with current theme
3. Imports both `global.css` and `tamagui-web.css`

### Theme System
- Custom theme context in `contexts/ThemeContext.tsx` provides `theme`, `toggleTheme`, and `isDark`
- Automatically detects system color scheme on initial load
- Theme state integrates with both Tamagui and Expo StatusBar
- Use `useTheme()` hook to access theme state in components

## File-Based Routing

Uses Expo Router with the following structure:
- `app/_layout.tsx` - Root layout with theme and Tamagui providers
- `app/index.tsx` - Main home screen with theme toggle
- Uses single-screen layout (no tabs currently configured)

## Desktop Integration (Electron)

- `electron/main.js` - Electron main process with security configurations
- Loads from Expo dev server in development (`localhost:8081`)
- Loads from `web-build/` directory in production
- Security features: disabled node integration, enabled context isolation
- Platform-specific behaviors for macOS window management

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
- **Desktop**: Electron wrapper for native desktop experience
- **Styling**: Both Tamagui and NativeWind work across all platforms
- **Icons**: Tamagui Lucide icons render appropriately on each platform
- **Navigation**: Expo Router handles both web URLs and native navigation
- **Theming**: Custom theme system works consistently across all platforms

## Code Quality Tools

The project uses **Biome** as the primary linting and formatting tool, with ESLint as a secondary check:
- `biome.json` - Comprehensive linting rules with TypeScript support
- Enforces modern Node.js import protocols (`node:` prefix)
- Automatically fixes common issues with `npm run lint`
- Always run `npm run check` before committing to ensure code quality

## TypeScript Configuration

The project uses TypeScript with Expo's configuration. Tamagui types are extended via module declaration in `tamagui.config.ts`.