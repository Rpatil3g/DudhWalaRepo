/**
 * IMPORTANT:
 * We MUST mock expo-sqlite BEFORE importing Database.js
 */

jest.mock('expo-sqlite', () => {
  const mockDb = {
    runSync: jest.fn(),
    getAllSync: jest.fn(),
  };

  return {
    openDatabaseSync: jest.fn(() => mockDb),
  };
});

import * as SQLite from 'expo-sqlite';
import {
  addCustomer,
  getAllCustomers,
  addProduct,
  recordSale,
  getCustomerDues,
} from '../Database';

/* -------------------------------------------------------------------------- */
/*                               TEST SETUP                                   */
/* -------------------------------------------------------------------------- */

// Get the SAME mocked DB instance used inside Database.js
const mockDb = SQLite.openDatabaseSync();

describe('Database Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ------------------------------------------------------------------------ */
  /*                           CUSTOMER OPERATIONS                             */
  /* ------------------------------------------------------------------------ */
  describe('Customer Operations', () => {
    it('adds a customer correctly', async () => {
      mockDb.runSync.mockReturnValue({ insertId: 1 });

      const result = await addCustomer(
        'John Doe',
        '123 Main St',
        '9876543210'
      );

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO customers'),
        'John Doe',
        '123 Main St',
        '9876543210'
      );

      expect(result).toBeUndefined();
    });

    it('fetches all active customers', async () => {
      const mockCustomers = [
        { id: 1, name: 'Alice', isActive: 1 },
        { id: 2, name: 'Bob', isActive: 1 },
      ];

      mockDb.getAllSync.mockReturnValue(mockCustomers);

      const result = await getAllCustomers();

      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('FROM customers')
      );

      expect(result).toEqual(mockCustomers);
    });
  });

  /* ------------------------------------------------------------------------ */
  /*                           PRODUCT OPERATIONS                              */
  /* ------------------------------------------------------------------------ */
  describe('Product Operations', () => {
    it('adds a product correctly', async () => {
      await addProduct('Cow Milk', 'Liter', 60);

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products'),
        'Cow Milk',
        'Liter',
        60
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /*                           SALES & DUES                                    */
  /* ------------------------------------------------------------------------ */
  describe('Sales & Dues', () => {
    it('records a sale correctly', async () => {
      await recordSale(1, 1, 2, 60, '2023-10-27');

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO daily_sales'),
        1,      // customer_id
        1,      // product_id
        2,      // quantity
        60,     // price_per_unit
        120,    // total_amount (2 * 60)
        '2023-10-27'
      );
    });

    it('calculates customer dues correctly', async () => {
      const mockDues = [
        { id: 1, name: 'Alice', total_due: 0 },
      ];

      mockDb.getAllSync.mockReturnValue(mockDues);

      const result = await getCustomerDues();

      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining('SUM')
      );

      expect(result).toEqual(mockDues);
    });
  });
});
