import { Moon, Sun } from '@tamagui/lucide-icons';
import { useTheme } from '../contexts/ThemeContext';
import { IconButton } from './IconButton';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      onPress={toggleTheme}
      backgroundColor="$background"
      color="$color"
      borderColor="$borderColor"
      borderWidth={1}
      pressStyle={{
        backgroundColor: '$backgroundPress',
        scale: 0.95,
      }}
      hoverStyle={{
        backgroundColor: '$backgroundHover',
      }}
    />
  );
}
