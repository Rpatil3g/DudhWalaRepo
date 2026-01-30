import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ReportsScreen from '../ReportsScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Database from '../../db/Database';

/* ----------------------------- DB MOCKS ----------------------------- */
jest.mock('../../db/Database', () => ({
  getTotalSalesForPeriod: jest.fn(),
  getCustomerDuesForPeriod: jest.fn(),
  getSalesForCustomer: jest.fn(),
  getPaymentsForCustomer: jest.fn(),
  getTotalDuesForCustomerUpToDate: jest.fn(),
}));

/* ------------------------- LIB MOCKS ---------------------------- */
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: 'test.pdf' })),
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

/* ----------------------- NATIVE MOCKS ----------------------- */
jest.mock('@react-native-community/datetimepicker', () => () => null);

/* ----------------------- UTIL ----------------------- */
const renderWithProvider = (ui) =>
  render(<PaperProvider>{ui}</PaperProvider>);

/* ----------------------- TESTS ----------------------- */
describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Database.getTotalSalesForPeriod.mockResolvedValue(1200);
    Database.getCustomerDuesForPeriod.mockResolvedValue([
      { id: 1, name: 'Alice', period_due: 300 },
    ]);
  });

  it('renders report data correctly', async () => {
    const { findByText } = renderWithProvider(<ReportsScreen />);

    expect(await findByText('₹1200.00')).toBeTruthy();
    expect(await findByText('Alice')).toBeTruthy();
    expect(await findByText('Period Due: ₹300.00')).toBeTruthy();
    expect(await findByText('Download Report')).toBeTruthy();
  });

  it('triggers report download', async () => {
    const { findByText } = renderWithProvider(<ReportsScreen />);

    const downloadBtn = await findByText('Download Report');
    fireEvent.press(downloadBtn);

    await waitFor(() => {
      expect(require('expo-print').printToFileAsync).toHaveBeenCalled();
      expect(require('expo-sharing').shareAsync).toHaveBeenCalled();
    });
  });
});