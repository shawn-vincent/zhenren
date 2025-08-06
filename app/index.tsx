import { Text, View, XStack } from 'tamagui';
import { Rocket } from '@tamagui/lucide-icons';
import { ThemeToggle } from '../components/ThemeToggle';

export default function HomeScreen() {
  return (
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
    </View>
  );
}
