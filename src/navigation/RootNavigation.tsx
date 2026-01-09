import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import { useUserStore } from "../store/userStore";

import LoginScreen from "../screens/Auth/LoginScreen";
import RegisterScreen from "../screens/Auth/RegisterScreen";
import ForgetPassword from "../screens/Auth/ForgetPassword";

// ✅ 1. 引入 CallScreen
import CallScreen from "../screens/Chat/CallScreen";
import ScanGroupScreen from '../screens/Contacts/ScanGroup';
const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isLoggedIn } = useUserStore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        // ✅ 2. 登录状态：加载 MainTabs 和全局 CallScreen
        <Stack.Group>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          
          {/* 🔥🔥🔥 核心修复：在这里注册 SingleCallScreen 🔥🔥🔥 */}
          <Stack.Screen 
            name="SingleCallScreen" 
            component={CallScreen} 
            options={{
              presentation: 'fullScreenModal', // 全屏模式，像真实来电一样覆盖
              gestureEnabled: false,           // 禁止手势划走
              headerShown: false
            }}
          />
          <Stack.Screen 
            name="ScanGroupScreen" 
            component={ScanGroupScreen}
            options={{ 
              presentation: 'fullScreenModal', // 建议：从底部弹起或全屏覆盖
              headerShown: false 
            }} 
          />
        </Stack.Group>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

/* AUTH STACK */
const AuthStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="Forget" component={ForgetPassword} />
    </AuthStack.Navigator>
  );
}