import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ManageGlobalProductsScreen from '../ManageGlobalProductsScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Database from '../../db/Database';

/* ----------------------------- DB MOCKS ----------------------------- */
jest.mock('../../db/Database', () => ({
  getAllProducts: jest.fn(),
  updateProduct: jest.fn(),
  updateAllCustomPricesForProduct: jest.fn(),
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
describe('ManageGlobalProductsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Database.getAllProducts.mockResolvedValue([
      { id: 1, name: 'Buffalo Milk', unit: 'Liter', default_price: 70 },
    ]);
  });

  it('renders product list', async () => {
    const { findByText } = renderWithProvider(<ManageGlobalProductsScreen />);

    expect(await findByText('Buffalo Milk')).toBeTruthy();
    expect(await findByText(/Price: ₹70.00/)).toBeTruthy();
  });

  it('opens modal to edit product', async () => {
    const { findByText } = renderWithProvider(<ManageGlobalProductsScreen />);

    fireEvent.press(await findByText('Buffalo Milk'));

    expect(await findByText('Edit Product')).toBeTruthy();
  });
});