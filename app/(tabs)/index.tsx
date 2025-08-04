import { View, Text, Button } from 'tamagui';
import { Heart } from '@tamagui/lucide-icons';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white p-4">
      <View className="items-center space-y-4">
        <Heart size={48} color="$red10" />
        <Text fontSize={28} fontWeight="bold" color="$gray12">
          Hello World!
        </Text>
        <Text fontSize={16} color="$gray10" textAlign="center" className="mb-4">
          Welcome to your new Expo app with Tamagui and NativeWind
        </Text>
        <Button 
          size="$4" 
          theme="blue" 
          className="bg-blue-500 hover:bg-blue-600"
          onPress={() => alert('Hello from Tamagui!')}
        >
          Tap me!
        </Button>
      </View>
    </View>
  );
}