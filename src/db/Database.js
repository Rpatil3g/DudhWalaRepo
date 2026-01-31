/*
================================================================================
File: src/db/Database.js
Description: SQLite Database setup and helper functions.
*** UPDATED: getAllCustomers now includes default product info ***
================================================================================
*/
import * as SQLite from 'expo-sqlite';
import { format, startOfMonth } from 'date-fns';

// Initialize DB connection synchronously (the object itself), but use async methods for ops.
const db = SQLite.openDatabaseSync('MilkwalaExpo.db');

// --- Database Initialization ---
export const initDatabase = async () => {
    try {
        await db.execAsync('PRAGMA foreign_keys = ON;');
        
        await db.withTransactionAsync(async () => {
            // Customers Table
            await db.execAsync(
                `CREATE TABLE IF NOT EXISTS customers(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(50) NOT NULL,
                    address TEXT,
                    phone VARCHAR(15),
                    isActive INTEGER DEFAULT 1
                );`
            );

            // Products Table
            await db.execAsync(
                `CREATE TABLE IF NOT EXISTS products(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(50) NOT NULL,
                    unit VARCHAR(20) NOT NULL,
                    default_price REAL NOT NULL
                );`
            );

            // Customer Products Assignment Table
            await db.execAsync(
                `CREATE TABLE IF NOT EXISTS customer_products(
                    customer_id INTEGER,
                    product_id INTEGER,
                    custom_price REAL,
                    default_quantity REAL DEFAULT 1,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    PRIMARY KEY (customer_id, product_id)
                );`
            );

            // Daily Sales Table
            await db.execAsync(
                `CREATE TABLE IF NOT EXISTS daily_sales(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER,
                    product_id INTEGER,
                    quantity REAL,
                    price_per_unit REAL,
                    total_amount REAL,
                    sale_date DATE,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
                );`
            );

            // Payments Table
            await db.execAsync(
                `CREATE TABLE IF NOT EXISTS payments(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER,
                    amount_paid REAL,
                    payment_date DATE,
                    notes TEXT,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
                );`
            );

            // Expenses Table
            await db.execAsync(
                `CREATE TABLE IF NOT EXISTS expenses(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL NOT NULL,
                    category VARCHAR(50),
                    note TEXT,
                    expense_date DATE NOT NULL
                );`
            );
        });

        // --- MIGRATIONS & OPTIMIZATIONS ---
        try {
            const tableInfo = await db.getAllAsync("PRAGMA table_info(expenses)");
            
            // 1. Add 'note' if missing
            if (!tableInfo.some(column => column.name === 'note')) {
                await db.execAsync("ALTER TABLE expenses ADD COLUMN note TEXT;");
            }
            // 2. Add 'category' if missing
            if (!tableInfo.some(column => column.name === 'category')) {
                await db.execAsync("ALTER TABLE expenses ADD COLUMN category VARCHAR(50);");
            }
            // 3. Remove 'title' if present
            if (tableInfo.some(column => column.name === 'title')) {
                await db.execAsync("ALTER TABLE expenses DROP COLUMN title;");
            }

            // 4. PERFORMANCE INDEXES (Crucial for fast dashboard loading)
            await db.execAsync("CREATE INDEX IF NOT EXISTS idx_sales_date ON daily_sales(sale_date);");
            await db.execAsync("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);");
            await db.execAsync("CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);");
            await db.execAsync("CREATE INDEX IF NOT EXISTS idx_sales_customer ON daily_sales(customer_id);");

        } catch (migrationError) {
            console.error("Migration/Indexing failed:", migrationError);
        }

        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Database initialization error:", error);
        throw error;
    }
};

// --- Customer Operations ---
export const addCustomer = async (name, address, phone) => {
    try {
        const result = await db.runAsync(
            'INSERT INTO customers (name, address, phone) VALUES (?,?,?)', 
            [name, address, phone]
        );
        return result.lastInsertRowId;
    } catch (error) {
        console.error("Error adding customer:", error);
        throw error;
    }
};

export const updateCustomer = async (id, name, address, phone) => {
    try {
        await db.runAsync(
            'UPDATE customers SET name = ?, address = ?, phone = ? WHERE id = ?', 
            [name, address, phone, id]
        );
    } catch (error) {
        console.error("Error updating customer:", error);
        throw error;
    }
};

export const getAllCustomers = async () => {
    try {
        // UPDATED QUERY: Left Join to get default product name even if no sale exists
        // Group by c.id ensures distinct customers in list
        const result = await db.getAllAsync(`
            SELECT c.*, p.name as default_product_name
            FROM customers c
            LEFT JOIN customer_products cp ON c.id = cp.customer_id
            LEFT JOIN products p ON cp.product_id = p.id
            WHERE c.isActive = 1 
            GROUP BY c.id
            ORDER BY c.name ASC
        `);
        return result;
    } catch (error) {
        console.error("Error fetching customers:", error);
        throw error;
    }
};

export const getCustomerById = async (id) => {
    try {
        const result = await db.getFirstAsync('SELECT * FROM customers WHERE id = ?', [id]);
        return result;
    } catch (error) {
        console.error("Error fetching customer by ID:", error);
        throw error;
    }
};

export const deleteCustomer = async (id) => {
    try {
        // Soft delete
        await db.runAsync('UPDATE customers SET isActive = 0 WHERE id = ?', [id]);
    } catch (error) {
        console.error("Error deleting customer:", error);
        throw error;
    }
};

// --- Product Operations ---
export const getAllProducts = async () => {
    try {
        const result = await db.getAllAsync('SELECT * FROM products');
        return result;
    } catch (error) {
        console.error("Error fetching products:", error);
        throw error;
    }
};

export const addProduct = async (name, unit, defaultPrice) => {
    try {
        const result = await db.runAsync(
            'INSERT INTO products (name, unit, default_price) VALUES (?,?,?)', 
            [name, unit, defaultPrice]
        );
        return result.lastInsertRowId;
    } catch (error) {
        console.error("Error adding product:", error);
        throw error;
    }
};

export const updateProduct = async (id, name, unit, defaultPrice) => {
    try {
        await db.runAsync(
            'UPDATE products SET name = ?, unit = ?, default_price = ? WHERE id = ?', 
            [name, unit, defaultPrice, id]
        );
    } catch (error) {
        console.error("Error updating product:", error);
        throw error;
    }
};

// --- Customer-Product Assignment ---
export const assignProductToCustomer = async (customerId, productId, customPrice, defaultQuantity) => {
    try {
        await db.runAsync(`
            INSERT INTO customer_products (customer_id, product_id, custom_price, default_quantity) 
            VALUES (?,?,?,?) 
            ON CONFLICT(customer_id, product_id) 
            DO UPDATE SET custom_price=excluded.custom_price, default_quantity=excluded.default_quantity
        `, [customerId, productId, customPrice, defaultQuantity]);
    } catch (error) {
        console.error("Error assigning product:", error);
        throw error;
    }
};

export const getCustomerProducts = async (customerId) => {
    try {
        const result = await db.getAllAsync(`
            SELECT p.*, cp.custom_price, cp.default_quantity 
            FROM products p 
            JOIN customer_products cp ON p.id = cp.product_id 
            WHERE cp.customer_id = ?
        `, [customerId]);
        return result;
    } catch (error) {
        console.error("Error fetching customer products:", error);
        throw error;
    }
};

export const updateAllCustomPricesForProduct = async (productId, newPrice) => {
    try {
        await db.runAsync(
            'UPDATE customer_products SET custom_price = ? WHERE product_id = ?', 
            [newPrice, productId]
        );
    } catch (error) {
        console.error("Error updating custom prices:", error);
        throw error;
    }
};

// --- Sales Operations ---
export const recordSale = async (customerId, productId, quantity, pricePerUnit, date) => {
    try {
        const totalAmount = quantity * pricePerUnit;
        const result = await db.runAsync(
            'INSERT INTO daily_sales (customer_id, product_id, quantity, price_per_unit, total_amount, sale_date) VALUES (?,?,?,?,?,?)',
            [customerId, productId, quantity, pricePerUnit, totalAmount, date]
        );
        return result.lastInsertRowId;
    } catch (error) {
        console.error("Error recording sale:", error);
        throw error;
    }
};

export const updateSale = async (saleId, quantity, pricePerUnit, date) => {
    try {
        const totalAmount = quantity * pricePerUnit;
        await db.runAsync(
            'UPDATE daily_sales SET quantity=?, price_per_unit=?, total_amount=?, sale_date=? WHERE id=?',
            [quantity, pricePerUnit, totalAmount, date, saleId]
        );
    } catch (error) {
        console.error("Error updating sale:", error);
        throw error;
    }
};

export const deleteSale = async (saleId) => {
    try {
        await db.runAsync('DELETE FROM daily_sales WHERE id = ?', [saleId]);
    } catch (error) {
        console.error("Error deleting sale:", error);
        throw error;
    }
};

export const getSalesDataForDate = async (date) => {
    try {
        const result = await db.getAllAsync(`
            SELECT ds.*, c.name as customer_name, p.name as product_name, ds.id as sale_id 
            FROM daily_sales ds
            JOIN customers c ON ds.customer_id = c.id
            JOIN products p ON ds.product_id = p.id
            WHERE ds.sale_date = ?
        `, [date]);
        return result;
    } catch (error) {
        console.error("Error getting sales for date:", error);
        throw error;
    }
};

export const getSaleForCustomerProductAndDate = async (customerId, productId, date) => {
    try {
        const result = await db.getFirstAsync(
            'SELECT * FROM daily_sales WHERE customer_id = ? AND product_id = ? AND sale_date = ?',
            [customerId, productId, date]
        );
        return result;
    } catch (error) {
        console.error("Error getting specific sale:", error);
        throw error;
    }
};

export const getTotalSalesForPeriod = async (startDate, endDate) => {
    try {
        const result = await db.getFirstAsync(
            'SELECT SUM(total_amount) as total FROM daily_sales WHERE sale_date BETWEEN ? AND ?',
            [startDate, endDate]
        );
        return result?.total || 0;
    } catch (error) {
        console.error("Error getting total sales:", error);
        throw error;
    }
};

export const getSalesForCustomer = async (customerId, startDate, endDate) => {
    try {
        const result = await db.getAllAsync(`
            SELECT ds.*, p.name as product_name
            FROM daily_sales ds
            JOIN products p ON ds.product_id = p.id
            WHERE ds.customer_id = ? AND ds.sale_date BETWEEN ? AND ?
            ORDER BY ds.sale_date DESC
        `, [customerId, startDate, endDate]);
        return result;
    } catch (error) {
        console.error("Error getting sales for customer:", error);
        throw error;
    }
};

export const getLastSevenDaysSalesForCustomer = async (customerId) => {
    try {
        const result = await db.getAllAsync(`
            SELECT DISTINCT sale_date 
            FROM daily_sales 
            WHERE customer_id = ? 
            ORDER BY sale_date DESC 
            LIMIT 7
        `, [customerId]);
        return result.map(r => r.sale_date);
    } catch (error) {
        console.error("Error getting recent sales history:", error);
        throw error;
    }
};

// --- Payment Operations ---
export const recordPayment = async (customerId, amount, date, notes) => {
    try {
        await db.runAsync(
            'INSERT INTO payments (customer_id, amount_paid, payment_date, notes) VALUES (?,?,?,?)',
            [customerId, amount, date, notes]
        );
    } catch (error) {
        console.error("Error recording payment:", error);
        throw error;
    }
};

export const getPaymentsForCustomer = async (customerId, startDate, endDate) => {
    try {
        const result = await db.getAllAsync(
            'SELECT * FROM payments WHERE customer_id = ? AND payment_date BETWEEN ? AND ? ORDER BY payment_date DESC',
            [customerId, startDate, endDate]
        );
        return result;
    } catch (error) {
        console.error("Error getting payments:", error);
        throw error;
    }
};

// --- Dues Calculations ---
export const getCustomerDues = async () => {
    try {
        const result = await db.getAllAsync(`
            SELECT c.id, c.name, 
            (SELECT SUM(total_amount) FROM daily_sales WHERE customer_id = c.id) as total_sales,
            (SELECT SUM(amount_paid) FROM payments WHERE customer_id = c.id) as total_paid
            FROM customers c
            WHERE c.isActive = 1
        `);
        
        return result.map(r => ({
            id: r.id,
            name: r.name,
            total_due: (r.total_sales || 0) - (r.total_paid || 0)
        }));
    } catch (error) {
        console.error("Error calculating dues:", error);
        throw error;
    }
};

export const getTotalDuesForCustomerUpToDate = async (customerId, date) => {
    try {
        const salesRes = await db.getFirstAsync(
            'SELECT SUM(total_amount) as total FROM daily_sales WHERE customer_id = ? AND sale_date <= ?',
            [customerId, date]
        );
        const payRes = await db.getFirstAsync(
            'SELECT SUM(amount_paid) as total FROM payments WHERE customer_id = ? AND payment_date <= ?',
            [customerId, date]
        );
        
        return (salesRes?.total || 0) - (payRes?.total || 0);
    } catch (error) {
        console.error("Error calculating total due up to date:", error);
        throw error;
    }
};

export const getComprehensiveCustomerDues = async (startDate, endDate) => {
    try {
        const result = await db.getAllAsync(`
            SELECT
                c.id, c.name, c.phone,
                (SELECT IFNULL(SUM(total_amount), 0) FROM daily_sales WHERE customer_id = c.id) as lifetime_sales,
                (SELECT IFNULL(SUM(amount_paid), 0) FROM payments WHERE customer_id = c.id) as lifetime_payments,
                (SELECT IFNULL(SUM(total_amount), 0) FROM daily_sales WHERE customer_id = c.id AND sale_date BETWEEN ? AND ?) as period_sales,
                (SELECT IFNULL(SUM(amount_paid), 0) FROM payments WHERE customer_id = c.id AND payment_date BETWEEN ? AND ?) as period_payments
            FROM customers c
            WHERE c.isActive = 1
            ORDER BY c.name ASC
        `, [startDate, endDate, startDate, endDate]);

        return result.map(r => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            total_due: r.lifetime_sales - r.lifetime_payments,
            period_due: r.period_sales - r.period_payments,
            period_sales: r.period_sales,
            period_payments: r.period_payments
        }));
    } catch (error) {
        console.error("Error getting comprehensive dues:", error);
        throw error;
    }
};

// --- EXPENSE OPERATIONS ---
export const addExpense = async (expense) => {
    try {
        await db.runAsync(
            'INSERT INTO expenses (amount, category, note, expense_date) VALUES (?,?,?,?)',
            [expense.amount, expense.category, expense.note, expense.date]
        );
    } catch (err) {
        console.error("Failed to add expense", err);
        throw err;
    }
};

export const updateExpense = async (expense) => {
    try {
        await db.runAsync(
            'UPDATE expenses SET amount = ?, category = ?, note = ?, expense_date = ? WHERE id = ?',
            [expense.amount, expense.category, expense.note, expense.date, expense.id]
        );
    } catch (error) {
        console.error("Failed to update expense", error);
        throw error;
    }
};

export const getExpensesForPeriod = async (startDate, endDate) => {
    try {
        const result = await db.getAllAsync(
            'SELECT * FROM expenses WHERE expense_date BETWEEN ? AND ? ORDER BY expense_date DESC',
            [startDate, endDate]
        );
        return result;
    } catch (error) {
        console.error("Error getting expenses:", error);
        throw error;
    }
};

export const getTotalExpensesForPeriod = async (startDate, endDate) => {
    try {
        const result = await db.getFirstAsync(
            'SELECT SUM(amount) as total FROM expenses WHERE expense_date BETWEEN ? AND ?',
            [startDate, endDate]
        );
        return result?.total || 0;
    } catch (error) {
        console.error("Error calculating total expenses:", error);
        throw error;
    }
};

export const getUniqueCategories = async () => {
    try {
        const result = await db.getAllAsync('SELECT DISTINCT category FROM expenses ORDER BY category ASC');
        return result.map(r => r.category).filter(c => c);
    } catch (error) {
        console.error("Error getting categories:", error);
        throw error;
    }
};

export const deleteExpense = async (id) => {
    try {
        await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
    } catch (error) {
        console.error("Error deleting expense:", error);
        throw error;
    }
};

// --- Backup Operations ---
export const getAllDataForBackup = async () => {
    try {
        const today = new Date();
        const startOfMonthString = format(startOfMonth(today), 'yyyy-MM-dd');
        const todayString = format(today, 'yyyy-MM-dd');

        // Using Promise.all for parallel fetching
        const [customers, products, sales, payments, expenses] = await Promise.all([
            db.getAllAsync('SELECT * FROM customers'),
            db.getAllAsync('SELECT * FROM products'),
            db.getAllAsync('SELECT * FROM daily_sales WHERE sale_date BETWEEN ? AND ?', [startOfMonthString, todayString]),
            db.getAllAsync('SELECT * FROM payments WHERE payment_date BETWEEN ? AND ?', [startOfMonthString, todayString]),
            db.getAllAsync('SELECT * FROM expenses WHERE expense_date BETWEEN ? AND ?', [startOfMonthString, todayString])
        ]);

        return {
            backupDate: todayString,
            customers,
            products,
            sales,
            payments,
            expenses
        };
    } catch (error) {
        console.error("Error gathering backup data:", error);
        throw error;
    }
};