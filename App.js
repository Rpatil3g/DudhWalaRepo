/*
================================================================================
File: App.js
Description: Main entry point and Navigation setup.
*** UPDATED: Added Expenses Screen to Tab Navigator. ***
================================================================================
*/
import 'react-native-gesture-handler'; // This must be the very first import
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
import ExpensesScreen from './src/screens/ExpensesScreen'; // NEW
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
        headerTitleStyle: { fontWeight: 'bold' },
      }}>
      <Stack.Screen name="CustomersList" component={CustomersScreen} options={{ title: 'Customers' }} />
      <Stack.Screen name="AddEditCustomer" component={AddEditCustomerScreen} options={{ title: 'Manage Customer' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer Details' }} />
      <Stack.Screen name="ManageProducts" component={ManageProductsScreen} options={{ title: 'Assign Products' }} />
    </Stack.Navigator>
  );
}

// Dashboard Stack Navigator (to include Global Products management)
function DashboardStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
            }}>
            <Stack.Screen 
                name="DashboardMain" 
                component={DashboardScreen} 
                options={({ navigation }) => ({
                    title: 'Dashboard',
                    headerRight: () => (
                        <IconButton
                            icon="cog"
                            color="#fff"
                            onPress={() => navigation.navigate('ManageGlobalProducts')}
                        />
                    )
                })} 
            />
            <Stack.Screen name="ManageGlobalProducts" component={ManageGlobalProductsScreen} options={{ title: 'Product Inventory' }} />
        </Stack.Navigator>
    );
}

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
          else if (route.name === 'Customers') iconName = focused ? 'account-group' : 'account-group-outline';
          else if (route.name === 'Expenses') iconName = focused ? 'cash-minus' : 'cash-minus'; // NEW ICON
          else if (route.name === 'Reports') iconName = focused ? 'chart-bar' : 'chart-bar-stacked';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}>
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Customers" component={CustomerStack} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Expenses', headerShown: true, headerStyle: { backgroundColor: theme.colors.primary }, headerTintColor: '#fff' }} /> 
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports', headerShown: true, headerStyle: { backgroundColor: theme.colors.primary }, headerTintColor: '#fff' }} />
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
            });
    }, []);

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
                <MainTabs />
            </NavigationContainer>
        </PaperProvider>
    );
}