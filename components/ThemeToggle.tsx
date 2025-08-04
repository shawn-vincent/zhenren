import { Button } from 'tamagui';
import { Sun, Moon } from '@tamagui/lucide-icons';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Button
      size="$3"
      circular
      onPress={toggleTheme}
      backgroundColor="$background"
      borderColor="$borderColor"
      borderWidth={1}
      pressStyle={{
        backgroundColor: '$backgroundPress',
        scale: 0.95,
      }}
      hoverStyle={{
        backgroundColor: '$backgroundHover',
      }}
    >
      {isDark ? (
        <Sun size={20} color="$color" />
      ) : (
        <Moon size={20} color="$color" />
      )}
    </Button>
  );
}