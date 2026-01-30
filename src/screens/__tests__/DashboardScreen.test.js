import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DashboardScreen from '../DashboardScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Database from '../../db/Database';

/* ----------------------------- DB MOCKS ----------------------------- */
jest.mock('../../db/Database', () => ({
  getTotalSalesForPeriod: jest.fn(),
  getCustomerDues: jest.fn(),
  getAllDataForBackup: jest.fn(),
}));

/* ------------------------- LIB MOCKS ---------------------------- */
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test-directory/',
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  EncodingType: { UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

/* ------------------------- NAVIGATION MOCK -------------------------- */
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb) => {
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

/* ----------------------- UTIL ----------------------- */
const renderWithProvider = (ui) =>
  render(<PaperProvider>{ui}</PaperProvider>);

/* ----------------------- TESTS ----------------------- */
describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Database.getTotalSalesForPeriod.mockResolvedValueOnce(500); // Today
    Database.getTotalSalesForPeriod.mockResolvedValueOnce(15000); // Month
    Database.getCustomerDues.mockResolvedValue([
      { id: 1, name: 'Alice', total_due: 200 },
    ]);
    Database.getAllDataForBackup.mockResolvedValue({ customers: [] });
  });

  it('renders sales summary and dues', async () => {
    const { findByText } = renderWithProvider(<DashboardScreen />);

    expect(await findByText("Today's Sales")).toBeTruthy();
    expect(await findByText('₹500.00')).toBeTruthy();
    expect(await findByText('₹15000.00')).toBeTruthy();
    expect(await findByText('Alice')).toBeTruthy();
    expect(await findByText('₹200.00')).toBeTruthy();
  });

  it('initiates backup process', async () => {
    const { findByText } = renderWithProvider(<DashboardScreen />);

    const backupBtn = await findByText("Backup This Month's Data");
    fireEvent.press(backupBtn);

    await waitFor(() => {
      expect(Database.getAllDataForBackup).toHaveBeenCalled();
      expect(require('expo-file-system').writeAsStringAsync).toHaveBeenCalled();
      expect(require('expo-sharing').shareAsync).toHaveBeenCalled();
    });
  });
});