// Jest Setup File
// We use 'require' here to avoid ES Module issues during the test setup phase

// Import Jest Native matchers
require('@testing-library/jest-native/extend-expect');

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    withTransactionSync: jest.fn((callback) => callback()),
    execSync: jest.fn(),
    runSync: jest.fn((query, ...args) => ({ lastInsertRowId: 1, changes: 1 })),
    getAllSync: jest.fn(),
    getFirstSync: jest.fn(),
  })),
}));

// Mock Alert
jest.spyOn(require('react-native').Alert, 'alert');

// --- GLOBAL MOCKS ---

// Mock expo-print
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: 'test.pdf' })),
}), { virtual: true });

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}), { virtual: true });

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test-directory/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  EncodingType: { UTF8: 'utf8' },
}), { virtual: true });

// Mock Vector Icons (Fixes React Native Paper warnings/errors)
// We mock both @expo/vector-icons and react-native-vector-icons to be safe
const MockIcon = (props) => {
  const { View } = require('react-native');
  return <View {...props} />;
};

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: MockIcon,
  Ionicons: MockIcon,
  FontAwesome: MockIcon,
}), { virtual: true });

jest.mock('react-native-paper/src/components/MaterialCommunityIcon', () => {
  return () => null;
});