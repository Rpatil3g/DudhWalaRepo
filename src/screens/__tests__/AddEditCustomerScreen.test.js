import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddEditCustomerScreen from '../AddEditCustomerScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Database from '../../db/Database';

/* ----------------------------- DB MOCKS ----------------------------- */
jest.mock('../../db/Database', () => ({
  addCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  getCustomerById: jest.fn(),
}));

/* ------------------------- NAVIGATION MOCK -------------------------- */
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams = { customerId: undefined };

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: mockRouteParams,
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
describe('AddEditCustomerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { customerId: undefined };

    Database.getCustomerById.mockResolvedValue({
      id: 1,
      name: 'Existing Customer',
      address: 'Old Address',
      phone: '9876543210',
    });
  });

  it('renders add customer form correctly', async () => {
    const { findByText, getAllByText } = renderWithProvider(<AddEditCustomerScreen />);

    expect(await findByText('Add Customer')).toBeTruthy();
    // Check for label presence (Paper renders multiple labels for animation)
    expect(getAllByText('Name').length).toBeGreaterThan(0);
  });

  it('validates input and calls addCustomer', async () => {
    Database.addCustomer.mockResolvedValue(1);

    // getAllByTestId('text-input-outlined') targets Paper's internal input
    // Index 0: Name, 1: Address, 2: Phone
    const { getByText, getAllByTestId } = renderWithProvider(<AddEditCustomerScreen />);
    const inputs = getAllByTestId('text-input-outlined');

    // Try saving empty
    fireEvent.press(getByText('Add Customer'));
    expect(Database.addCustomer).not.toHaveBeenCalled();

    // Fill Form
    fireEvent.changeText(inputs[0], 'New Guy');
    fireEvent.changeText(inputs[2], '9999999999');

    // Save
    fireEvent.press(getByText('Add Customer'));

    await waitFor(() => {
      expect(Database.addCustomer).toHaveBeenCalledWith('New Guy', '', '9999999999');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('loads existing customer data in edit mode', async () => {
    mockRouteParams = { customerId: 1 }; // Switch to Edit Mode

    const { findByText, getAllByTestId } = renderWithProvider(<AddEditCustomerScreen />);
    const inputs = getAllByTestId('text-input-outlined');

    // Wait for DB fetch
    await waitFor(() => expect(Database.getCustomerById).toHaveBeenCalledWith(1));

    expect(await findByText('Update Customer')).toBeTruthy();
    // Check input values
    expect(inputs[0].props.value).toBe('Existing Customer');
    expect(inputs[1].props.value).toBe('Old Address');
  });
});