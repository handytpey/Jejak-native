import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NewProjectScreen from './src/screens/NewProjectScreen';
import ProjectDetailScreen from './src/screens/ProjectDetailScreen';
import JoinScreen from './src/screens/JoinScreen';
import { colors } from './src/theme';

// Konfigurasi biar app ini bisa dibuka langsung dari URL (dipakai buat
// link/QR undangan) — misal https://jejak-native.vercel.app/j/abc123
// otomatis kebuka ke JoinScreen dengan token "abc123".
const linking = {
  prefixes: ['https://jejak-native.vercel.app', 'jejak-native://'],
  config: {
    screens: {
      Login: 'login',
      Main: {
        screens: {
          Home: '',
          Profile: 'profile',
        },
      },
      NewProject: 'new',
      ProjectDetail: 'project/:projectId',
      Join: 'j/:token',
    },
  },
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Ikon custom pakai SVG langsung (bukan font icon bawaan React Navigation)
// — font icon itu kadang gagal kebawa penuh pas di-export ke web, jadi
// keluar kotak/segitiga aneh sebagai gantinya. SVG gambar sendiri gak
// punya masalah itu sama sekali.
function HomeIcon({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11.5L12 4l9 7.5" />
      <Path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

function ProfileIcon({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={3.5} />
      <Path d="M4.5 20c1.4-3.5 4.3-5.5 7.5-5.5s6.1 2 7.5 5.5" />
    </Svg>
  );
}

// Bottom tabs (Home/Profile) — ini komponen NAVIGASI ASLI dari React
// Native, bukan CSS position:fixed. Otomatis selalu kelihatan, gak akan
// ada masalah "ketutup"/"dobel"/"mantul" kayak yang kita alamin di versi web.
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.amberDeep,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        // Bikin background tab bar nutupin sampai ujung layar (termasuk
        // area home-indicator iPhone), biar gak ada celah warna beda
        // yang keliatan kayak "footer nyasar" di paling bawah.
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          height: 82 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 14,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const [pendingToken, setPendingToken] = useState(undefined);

  useEffect(() => {
    if (!user) {
      setPendingToken(null);
      return;
    }
    // Setelah user login/daftar, cek apakah dia sempat scan link
    // undangan sebelum sempat login — kalau ada, lanjut proses join
    // otomatis begitu selesai login.
    AsyncStorage.getItem('pendingInviteToken').then((token) => setPendingToken(token || null));
  }, [user]);

  if (loading) return null;
  if (user && pendingToken === undefined) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={pendingToken ? 'Join' : undefined}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="NewProject" component={NewProjectScreen} />
          <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
          <Stack.Screen
            name="Join"
            component={JoinScreen}
            initialParams={pendingToken ? { token: pendingToken } : undefined}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Join" component={JoinScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
