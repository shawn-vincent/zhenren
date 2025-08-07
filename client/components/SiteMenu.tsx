import { Text, YStack } from 'tamagui';
import { X } from '@tamagui/lucide-icons';
import { Animated, Dimensions } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from './IconButton';

interface SiteMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const DRAWER_WIDTH = screenWidth * 0.8;

export function SiteMenu({ isOpen, onClose }: SiteMenuProps) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }

    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -DRAWER_WIDTH,
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
      
      {/* Site Menu */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: DRAWER_WIDTH,
          transform: [{ translateX: slideAnim }],
          zIndex: 999,
        }}
      >
        <YStack
          flex={1}
          backgroundColor="$background"
          borderRightWidth={1}
          borderRightColor="$borderColor"
          paddingTop="$6"
          paddingHorizontal="$4"
        >
          {/* Close button */}
          <IconButton
            icon={X}
            onPress={onClose}
            color="$color"
            alignSelf="flex-end"
            marginBottom="$4"
          />
          
          {/* Site menu content */}
          <YStack gap="$4">
            <Text fontSize="$6" fontWeight="bold" color="$color">
              Site Menu
            </Text>
            <Text fontSize="$4" color="$color">
              Site menu items will go here
            </Text>
          </YStack>
        </YStack>
      </Animated.View>
    </>
  );
}