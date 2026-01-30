import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CustomersScreen from '../CustomersScreen';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Database from '../../db/Database';

/* -------------------------------------------------------------------------- */
/*                               DB MOCKS                                     */
/* -------------------------------------------------------------------------- */
jest.mock('../../db/Database', () => ({
  getSalesDataForDate: jest.fn(),
  getCustomerProducts: jest.fn(),
  recordSale: jest.fn(),
  updateSale: jest.fn(),
  deleteSale: jest.fn(),
  getLastSevenDaysSalesForCustomer: jest.fn(),
  getSaleForCustomerProductAndDate: jest.fn(),
}));

/* -------------------------------------------------------------------------- */
/*                          NAVIGATION MOCK                                   */
/* -------------------------------------------------------------------------- */
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');

  return {
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useFocusEffect: (cb) => {
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

/* -------------------------------------------------------------------------- */
/*                        NATIVE COMPONENT MOCKS                               */
/* -------------------------------------------------------------------------- */
jest.mock('@react-native-community/datetimepicker', () => () => null);

/* -------------------------------------------------------------------------- */
/*                               UTIL                                         */
/* -------------------------------------------------------------------------- */
const renderWithProvider = (ui) =>
  render(<PaperProvider>{ui}</PaperProvider>);

/* -------------------------------------------------------------------------- */
/*                               TESTS                                        */
/* -------------------------------------------------------------------------- */
describe('CustomersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default safe mocks
    Database.recordSale.mockResolvedValue(1);
    Database.updateSale.mockResolvedValue();
    Database.deleteSale.mockResolvedValue();
    Database.getSaleForCustomerProductAndDate.mockResolvedValue(null);
    Database.getLastSevenDaysSalesForCustomer.mockResolvedValue([]);
  });

  /* ------------------------------------------------------------------------ */
  /*                         RENDER CUSTOMER LIST                              */
  /* ------------------------------------------------------------------------ */
  it('renders customer list correctly', async () => {
    Database.getSalesDataForDate.mockResolvedValue([
      {
        customer_id: 1,
        customer_name: 'Bob',
        product_id: 101,
        product_name: 'Cow Milk',
        sale_id: null,
        default_quantity: 1,
        unit: 'Liter',
        custom_price: 60,
      },
    ]);

    Database.getCustomerProducts.mockResolvedValue([
      {
        id: 101,
        name: 'Cow Milk',
        default_quantity: 1,
        unit: 'Liter',
        custom_price: 60,
      },
    ]);

    const { findByText } = renderWithProvider(<CustomersScreen />);

    expect(await findByText(/Bob/)).toBeTruthy();
    expect(await findByText(/Cow Milk/)).toBeTruthy();
    expect(await findByText(/Add Entry/)).toBeTruthy();
  });

  /* ------------------------------------------------------------------------ */
  /*                        ADD SALE FLOW                                      */
  /* ------------------------------------------------------------------------ */
  it('opens modal and records a sale', async () => {
    Database.getSalesDataForDate.mockResolvedValue([
      {
        customer_id: 1,
        customer_name: 'Bob',
        product_id: 102,
        product_name: 'Buffalo Milk',
        sale_id: null,
        default_quantity: 1.5,
        unit: 'Liter',
        custom_price: 70,
      },
    ]);

    Database.getCustomerProducts.mockResolvedValue([
      {
        id: 102,
        name: 'Buffalo Milk',
        default_quantity: 1.5,
        unit: 'Liter',
        custom_price: 70,
      },
    ]);

    const { findByText, getByText } = renderWithProvider(
      <CustomersScreen />
    );

    // Wait for screen data to load
    await findByText(/Bob/);

    // Open modal
    fireEvent.press(getByText('Add Entry'));

    // Wait for modal content
    const saveButton = await findByText('Save');

    // Save entry
    fireEvent.press(saveButton);

    // Verify DB call
    await waitFor(() => {
      expect(Database.recordSale).toHaveBeenCalled();
    });
  });
});
