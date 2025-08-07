import { Button } from 'tamagui';
import { Platform } from 'react-native';
import { ComponentType } from 'react';

interface IconButtonProps {
  icon: ComponentType<any>;
  onPress: () => void;
  backgroundColor?: string;
  color?: string;
  circular?: boolean;
  chromeless?: boolean;
  alignSelf?: 'flex-start' | 'flex-end' | 'center';
  marginBottom?: string;
  borderColor?: string;
  borderWidth?: number;
  pressStyle?: object;
  hoverStyle?: object;
}

export function IconButton({
  icon,
  onPress,
  backgroundColor = 'transparent',
  color = '$gray11',
  circular = true,
  chromeless = false,
  alignSelf,
  marginBottom,
  borderColor,
  borderWidth,
  pressStyle,
  hoverStyle,
}: IconButtonProps) {
  const isWeb = Platform.OS === 'web';
  
  // Platform-specific sizing
  const buttonSize = isWeb ? '$3' : '$5';
  const scaleIcon = isWeb ? 1.4 : 1.8;

  return (
    <Button
      size={buttonSize}
      circular={circular}
      chromeless={chromeless}
      backgroundColor={backgroundColor}
      onPress={onPress}
      color={color}
      icon={icon}
      scaleIcon={scaleIcon}
      alignSelf={alignSelf}
      marginBottom={marginBottom}
      borderColor={borderColor}
      borderWidth={borderWidth}
      pressStyle={pressStyle}
      hoverStyle={hoverStyle}
    />
  );
}