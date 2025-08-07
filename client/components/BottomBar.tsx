import { XStack } from 'tamagui';
import { Menu, Settings } from '@tamagui/lucide-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { IconButton } from './IconButton';

interface BottomBarProps {
  onMenuPress: () => void;
  onSettingsPress: () => void;
}

export function BottomBar({ onMenuPress, onSettingsPress }: BottomBarProps) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  
  // Platform-specific sizing
  const horizontalPadding = isWeb ? '$3' : '$4';
  const verticalPadding = isWeb ? 6 : 8;
  
  return (
    <XStack
      backgroundColor="$gray2"
      borderTopWidth={1}
      borderTopColor="$gray5"
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal={horizontalPadding}
      paddingTop={verticalPadding}
      paddingBottom={insets.bottom + verticalPadding}
      elevation={4}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
    >
      <IconButton
        icon={Menu}
        onPress={onMenuPress}
        chromeless
        pressStyle={{
          backgroundColor: '$gray4',
          scale: 0.95,
        }}
      />
      
      <IconButton
        icon={Settings}
        onPress={onSettingsPress}
        chromeless
        pressStyle={{
          backgroundColor: '$gray4',
          scale: 0.95,
        }}
      />
    </XStack>
  );
}