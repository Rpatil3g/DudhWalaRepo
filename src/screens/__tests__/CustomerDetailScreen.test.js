import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CustomerDetailScreen from '../CustomerDetailScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Database from '../../db/Database';

/* ----------------------------- DB MOCKS ----------------------------- */
jest.mock('../../db/Database', () => ({
  getCustomerById: jest.fn(),
  getCustomerProducts: jest.fn(),
  getSalesForCustomer: jest.fn(),
  getPaymentsForCustomer: jest.fn(),
  getCustomerDues: jest.fn(),
  getTotalDuesForCustomerUpToDate: jest.fn(),
  deleteCustomer: jest.fn(),
  recordPayment: jest.fn(),
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

/* ----------------------- NATIVE MOCKS ----------------------- */
jest.mock('@react-native-community/datetimepicker', () => () => null);

/* ----------------------- UTIL ----------------------- */
const renderWithProvider = (ui) =>
  render(<PaperProvider>{ui}</PaperProvider>);

/* ----------------------- TESTS ----------------------- */
describe('CustomerDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Database.getCustomerById.mockResolvedValue({
      id: 1,
      name: 'John Doe',
      address: '123 St',
      phone: '9999999999',
    });

    Database.getCustomerProducts.mockResolvedValue([
      {
        id: 101,
        name: 'Milk',
        default_quantity: 1,
        unit: 'Liter',
        custom_price: 60,
      },
    ]);

    Database.getSalesForCustomer.mockResolvedValue([]);
    Database.getPaymentsForCustomer.mockResolvedValue([]);
    Database.getCustomerDues.mockResolvedValue([
      { id: 1, total_due: 500 },
    ]);
  });

  it('renders customer details, products, and total due', async () => {
    const { findByText } = renderWithProvider(<CustomerDetailScreen />);

    expect(await findByText(/John Doe/)).toBeTruthy();
    expect(await findByText(/123 St/)).toBeTruthy();
    expect(await findByText(/Milk \(1 Liter\)/)).toBeTruthy();
    expect(await findByText(/No recent sales/)).toBeTruthy();
    expect(await findByText(/Total Due/)).toBeTruthy();
  });

  it('deletes customer and navigates back', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      if (!buttons) return;

      const deleteBtn = buttons.find(b => b.text === 'Delete');
      if (deleteBtn) {
        deleteBtn.onPress();
      }
    });

    Database.deleteCustomer.mockResolvedValue();

    const { findByText, getByText } = renderWithProvider(
      <CustomerDetailScreen />
    );

    await findByText(/John Doe/);

    fireEvent.press(getByText('Delete'));

    await waitFor(() => {
      expect(Database.deleteCustomer).toHaveBeenCalledWith(1);
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
