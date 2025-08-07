import { Text, YStack } from 'tamagui';
import { X } from '@tamagui/lucide-icons';
import { Animated, Dimensions } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { IconButton } from './IconButton';

interface ConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const DRAWER_WIDTH = screenWidth * 0.8;

export function ConfigDrawer({ isOpen, onClose }: ConfigDrawerProps) {
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }

    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (!isOpen) {
        setShouldRender(false);
      }
    });
  }, [isOpen, slideAnim]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 998,
        }}
        onTouchEnd={onClose}
      />
      
      {/* Config Drawer */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: DRAWER_WIDTH,
          transform: [{ translateX: slideAnim }],
          zIndex: 999,
        }}
      >
        <YStack
          flex={1}
          backgroundColor="$background"
          borderLeftWidth={1}
          borderLeftColor="$borderColor"
          paddingTop="$6"
          paddingHorizontal="$4"
        >
          {/* Close button */}
          <IconButton
            icon={X}
            onPress={onClose}
            color="$color"
            alignSelf="flex-start"
            marginBottom="$4"
          />
          
          {/* Config drawer content */}
          <YStack gap="$4">
            <Text fontSize="$6" fontWeight="bold" color="$color">
              Config Drawer
            </Text>
            
            {/* Theme toggle */}
            <YStack gap="$2">
              <Text fontSize="$4" color="$color">
                Theme
              </Text>
              <ThemeToggle />
            </YStack>
            
            <Text fontSize="$4" color="$color">
              More configuration options will go here
            </Text>
          </YStack>
        </YStack>
      </Animated.View>
    </>
  );
}