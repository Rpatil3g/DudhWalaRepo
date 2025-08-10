import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme, IconButton, ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { View } from 'react-native';

// Import Screens
import DashboardScreen from './src/screens/DashboardScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import AddEditCustomerScreen from './src/screens/AddEditCustomerScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import ManageProductsScreen from './src/screens/ManageProductsScreen';
import ManageGlobalProductsScreen from './src/screens/ManageGlobalProductsScreen';
import { initDatabase } from './src/db/Database';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0066cc',
    accent: '#f1c40f',
  },
};

// Customer Stack Navigator
function CustomerStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: '#fff',
      }}>
      <Stack.Screen name="CustomerList" component={CustomersScreen} options={{ title: 'Daily Sales' }} />
      <Stack.Screen name="AddEditCustomer" component={AddEditCustomerScreen} options={{ title: 'Add/Edit Customer' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer Details' }} />
      <Stack.Screen name="ManageProducts" component={ManageProductsScreen} options={{ title: 'Manage Products' }} />
    </Stack.Navigator>
  );
}

// Dashboard Stack Navigator
function DashboardStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTintColor: '#fff',
            }}>
            <Stack.Screen
                name="DashboardHome"
                component={DashboardScreen}
                options={({ navigation }) => ({ // Use a function to get the correct navigation prop
                    title: 'Dashboard',
                    headerRight: () => (
                        <IconButton
                            icon="pencil"
                            color="#fff"
                            onPress={() => navigation.navigate('ManageGlobalProducts')}
                        />
                    ),
                })}
            />
            <Stack.Screen
                name="ManageGlobalProducts"
                component={ManageGlobalProductsScreen}
                options={{ title: 'Manage All Products' }}
            />
        </Stack.Navigator>
    );
}

// Main App Tabs
function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
          else if (route.name === 'Customers') iconName = focused ? 'account-group' : 'account-group-outline';
          else if (route.name === 'Reports') iconName = focused ? 'chart-bar' : 'chart-bar-stacked';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}>
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Customers" component={CustomerStack} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
    </Tab.Navigator>
  );
}


export default function App() {
    const [dbInitialized, setDbInitialized] = useState(false);

    useEffect(() => {
        initDatabase()
            .then(() => {
                console.log('Database initialized successfully.');
                setDbInitialized(true);
            })
            .catch(err => {
                console.error('Database initialization failed:', err);
                // You could show an error message to the user here
            });
    }, []); // Empty dependency array ensures this runs only once on mount

    if (!dbInitialized) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 10 }}>Initializing Database...</Text>
            </View>
        );
    }

    return (
        <PaperProvider theme={theme}>
            <NavigationContainer>
                <AppTabs />
            </NavigationContainer>
        </PaperProvider>
    );
}
