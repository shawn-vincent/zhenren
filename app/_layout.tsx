import '../global.css';
import '../tamagui-web.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import config from '../tamagui.config';

function AppContent() {
  const { theme } = useTheme();

  return (
    <TamaguiProvider config={config} defaultTheme={theme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
