import { View, Text, YStack, Card, Button } from 'tamagui';
import { Palette, Zap, Smartphone } from '@tamagui/lucide-icons';

export default function TabTwoScreen() {
  return (
    <View className="flex-1 bg-gray-50 p-4">
      <YStack space="$4" className="pt-4">
        <Text fontSize={24} fontWeight="bold" color="$gray12" textAlign="center">
          Explore Features
        </Text>
        
        <Card elevate size="$4" className="bg-white p-4">
          <YStack space="$3" alignItems="center">
            <Palette size={32} color="$purple10" />
            <Text fontSize={18} fontWeight="600" color="$gray12">
              Tamagui Styling
            </Text>
            <Text fontSize={14} color="$gray10" textAlign="center">
              Beautiful, performant components with consistent theming
            </Text>
          </YStack>
        </Card>

        <Card elevate size="$4" className="bg-white p-4">
          <YStack space="$3" alignItems="center">
            <Zap size={32} color="$yellow10" />
            <Text fontSize={18} fontWeight="600" color="$gray12">
              NativeWind
            </Text>
            <Text fontSize={14} color="$gray10" textAlign="center">
              Tailwind CSS utility classes for React Native
            </Text>
          </YStack>
        </Card>

        <Card elevate size="$4" className="bg-white p-4">
          <YStack space="$3" alignItems="center">
            <Smartphone size={32} color="$green10" />
            <Text fontSize={18} fontWeight="600" color="$gray12">
              Universal App
            </Text>
            <Text fontSize={14} color="$gray10" textAlign="center">
              Works on iOS, Android, and Web with the same codebase
            </Text>
          </YStack>
        </Card>

        <Button 
          size="$4" 
          theme="purple" 
          className="mt-4"
          onPress={() => alert('Features explored!')}
        >
          Got it!
        </Button>
      </YStack>
    </View>
  );
}