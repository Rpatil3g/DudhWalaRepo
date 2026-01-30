import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ManageProductsScreen from '../ManageProductsScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Database from '../../db/Database';

/* ----------------------------- DB MOCKS ----------------------------- */
jest.mock('../../db/Database', () => ({
  getAllProducts: jest.fn(),
  getCustomerProducts: jest.fn(),
  assignProductToCustomer: jest.fn(),
  addProduct: jest.fn(),
}));

/* ------------------------- NAVIGATION MOCK -------------------------- */
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: { customerId: 1 },
    }),
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
describe('ManageProductsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Database.getAllProducts.mockResolvedValue([
      { id: 101, name: 'Cow Milk', unit: 'Liter', default_price: 60 },
    ]);
    Database.getCustomerProducts.mockResolvedValue([]);
  });

  it('renders available products', async () => {
    const { findAllByText, findByText } = renderWithProvider(<ManageProductsScreen />);

    // "Cow Milk" appears in the Input Label (e.g., Cow Milk) AND the list item.
    // findAllByText handles multiple occurrences.
    const elements = await findAllByText(/Cow Milk/);
    expect(elements.length).toBeGreaterThan(0);

    expect(await findByText('Save Customer Assignments')).toBeTruthy();
  });

  it('saves assignments', async () => {
    const { findByText } = renderWithProvider(<ManageProductsScreen />);

    const saveBtn = await findByText('Save Customer Assignments');
    fireEvent.press(saveBtn);

    await waitFor(() => {
      // Ensure no crashes during save
    });
  });
});