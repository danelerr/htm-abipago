import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import { C } from '@/constants/theme';
import { appKit, AppKit, AppKitProvider } from '@/services/appkit';

const AbiPagoDark = {
  ...DarkTheme,
  dark: true as const,
  colors: {
    ...DarkTheme.colors,
    primary: C.primary,
    background: C.bgDark,
    card: C.bgDark,
    text: C.white,
    border: C.borderDark,
  },
};

export default function RootLayout() {
  return (
    <AppKitProvider instance={appKit}>
      <ThemeProvider value={AbiPagoDark}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bgDark },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="merchant-invoice"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="confirm-payment" />
          <Stack.Screen name="routing-progress" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="payment-success"
            options={{ gestureEnabled: false, animation: 'fade' }}
          />
        </Stack>
        <StatusBar style="light" />

        {/* AppKit bottom-sheet modal – Android with Expo Router needs absolute wrapper */}
        {Platform.OS === 'android' ? (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <AppKit />
          </View>
        ) : (
          <AppKit />
        )}
      </ThemeProvider>
    </AppKitProvider>
  );
}
