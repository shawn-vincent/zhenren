import { Text, View, XStack } from 'tamagui';
import { Rocket } from '@tamagui/lucide-icons';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { BottomBar } from '../components/BottomBar';
import { SiteMenu } from '../components/SiteMenu';
import { ConfigDrawer } from '../components/ConfigDrawer';

export default function HomeScreen() {
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState(false);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar 
        style={isDark ? 'light' : 'dark'} 
        backgroundColor={isDark ? '#000000' : '#ffffff'} 
        translucent={false}
      />
      <SafeAreaView 
        style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#ffffff' }} 
        edges={['top']}
      >
        <View flex={1} backgroundColor="$background">
          {/* Theme toggle positioned in top-right corner */}
          <View position="absolute" top="$4" right="$4" zIndex={1000}>
            <ThemeToggle />
          </View>

          {/* Main content centered */}
          <View flex={1} justifyContent="center" alignItems="center">
            <XStack alignItems="center" gap="$3">
              <Rocket size={32} color="$color" />
              <Text fontSize={32} fontWeight="bold" color="$color">
                Hello World!
              </Text>
            </XStack>
          </View>

          {/* Site Menu */}
          <SiteMenu
            isOpen={isSiteMenuOpen}
            onClose={() => setIsSiteMenuOpen(false)}
          />

          {/* Config Drawer */}
          <ConfigDrawer
            isOpen={isConfigDrawerOpen}
            onClose={() => setIsConfigDrawerOpen(false)}
          />
        </View>
        
        {/* Bottom Bar outside SafeAreaView to handle bottom safe area itself */}
        <BottomBar
          onMenuPress={() => setIsSiteMenuOpen(!isSiteMenuOpen)}
          onSettingsPress={() => setIsConfigDrawerOpen(!isConfigDrawerOpen)}
        />
      </SafeAreaView>
    </>
  );
}
