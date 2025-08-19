
import * as SQLite from 'expo-sqlite';
import { format, startOfMonth } from 'date-fns';

const db = SQLite.openDatabaseSync('MilkwalaExpo.db');

// --- Database Initialization ---
export const initDatabase = () => {
  const promise = new Promise((resolve, reject) => {
    try {
        db.withTransactionSync(() => {
            db.execSync('PRAGMA foreign_keys = ON;');
            db.execSync(
            `CREATE TABLE IF NOT EXISTS customers(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(50) NOT NULL,
                address TEXT,
                phone VARCHAR(15),
                isActive INTEGER DEFAULT 1
            );`
            );
            db.execSync(
            `CREATE TABLE IF NOT EXISTS products(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(50) NOT NULL,
                unit VARCHAR(20) NOT NULL,
                default_price REAL NOT NULL
            );`
            );
            db.execSync(
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
            db.execSync(
            `CREATE TABLE IF NOT EXISTS daily_sales(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                product_id INTEGER,
                quantity REAL NOT NULL,
                price_per_unit REAL NOT NULL,
                total_amount REAL NOT NULL,
                sale_date TEXT NOT NULL,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );`
            );
            db.execSync(
            `CREATE TABLE IF NOT EXISTS payments(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER,
                amount_paid REAL NOT NULL,
                payment_date TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
            );`
            );
        });
        resolve();
    } catch (error) {
        reject(error);
    }
  });
  return promise;
};

// --- Customer Operations ---
export const addCustomer = (name, address, phone) => {
    return new Promise((resolve) => {
        const result = db.runSync('INSERT INTO customers (name, address, phone) VALUES (?,?,?)', name, address, phone);
        resolve(result.lastInsertRowId);
    });
};

export const updateCustomer = (id, name, address, phone) => {
    return new Promise((resolve) => {
        db.runSync('UPDATE customers SET name=?, address=?, phone=? WHERE id=?', name, address, phone, id);
        resolve();
    });
};

export const deleteCustomer = (id) => {
    return new Promise((resolve) => {
        db.runSync('UPDATE customers SET isActive = 0 WHERE id = ?', id);
        resolve();
    });
};

export const getAllCustomers = () => {
    return new Promise((resolve) => {
        const customers = db.getAllSync('SELECT * FROM customers WHERE isActive = 1 ORDER BY name ASC');
        resolve(customers);
    });
};

export const getCustomerById = (id) => {
     return new Promise((resolve) => {
        const customer = db.getFirstSync('SELECT * FROM customers WHERE id = ?', id);
        resolve(customer);
    });
}

// --- Product Operations ---
export const addProduct = (name, unit, default_price) => {
    return new Promise((resolve) => {
        const result = db.runSync('INSERT INTO products (name, unit, default_price) VALUES (?,?,?)', name, unit, default_price);
        resolve(result.lastInsertRowId);
    });
};

export const updateProduct = (id, name, unit, default_price) => {
    return new Promise((resolve) => {
        db.runSync('UPDATE products SET name = ?, unit = ?, default_price = ? WHERE id = ?', name, unit, default_price, id);
        resolve();
    });
};

export const getAllProducts = () => {
    return new Promise((resolve) => {
        const products = db.getAllSync('SELECT * FROM products ORDER BY name ASC');
        resolve(products);
    });
};

// --- Customer Product Association ---
export const assignProductToCustomer = (customerId, productId, customPrice, defaultQuantity) => {
     return new Promise((resolve) => {
        db.runSync('INSERT OR REPLACE INTO customer_products (customer_id, product_id, custom_price, default_quantity) VALUES (?,?,?,?)', customerId, productId, customPrice, defaultQuantity);
        resolve();
    });
};

export const updateAllCustomPricesForProduct = (productId, newPrice) => {
    return new Promise((resolve) => {
        db.runSync('UPDATE customer_products SET custom_price = ? WHERE product_id = ?', newPrice, productId);
        resolve();
    });
};

export const getCustomerProducts = (customerId) => {
    return new Promise((resolve) => {
        const products = db.getAllSync(
            `SELECT p.id, p.name, p.unit, cp.custom_price, cp.default_quantity
             FROM products p
             JOIN customer_products cp ON p.id = cp.product_id
             WHERE cp.customer_id = ?`,
            customerId
        );
        resolve(products);
    });
};

// --- Sales Operations ---
export const recordSale = (customerId, productId, quantity, pricePerUnit, saleDate) => {
    const totalAmount = quantity * pricePerUnit;
    return new Promise((resolve) => {
        const result = db.runSync('INSERT INTO daily_sales (customer_id, product_id, quantity, price_per_unit, total_amount, sale_date) VALUES (?,?,?,?,?,?)', customerId, productId, quantity, pricePerUnit, totalAmount, saleDate);
        resolve(result.lastInsertRowId);
    });
};

export const updateSale = (saleId, quantity, pricePerUnit, saleDate) => {
    const totalAmount = quantity * pricePerUnit;
    return new Promise((resolve) => {
        db.runSync(
            'UPDATE daily_sales SET quantity = ?, price_per_unit = ?, total_amount = ?, sale_date = ? WHERE id = ?',
            quantity, pricePerUnit, totalAmount, saleDate, saleId
        );
        resolve();
    });
};

export const deleteSale = (saleId) => {
    return new Promise((resolve) => {
        db.runSync('DELETE FROM daily_sales WHERE id = ?', saleId);
        resolve();
    });
};

export const getSalesForCustomer = (customerId, startDate, endDate) => {
    return new Promise((resolve) => {
        const sales = db.getAllSync(
            `SELECT ds.*, p.name as product_name 
             FROM daily_sales ds
             JOIN products p ON ds.product_id = p.id
             WHERE ds.customer_id = ? AND ds.sale_date BETWEEN ? AND ?
             ORDER BY ds.sale_date ASC`,
            customerId, startDate, endDate
        );
        resolve(sales);
    });
};

export const getSaleForCustomerProductAndDate = (customerId, productId, date) => {
    return new Promise((resolve) => {
        const sale = db.getFirstSync(
            `SELECT * FROM daily_sales WHERE customer_id = ? AND product_id = ? AND sale_date = ?`,
            customerId, productId, date
        );
        resolve(sale);
    });
};

export const getLastSevenDaysSalesForCustomer = (customerId) => {
    return new Promise((resolve) => {
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);
        const todayString = format(today, 'yyyy-MM-dd');
        const sevenDaysAgoString = format(sevenDaysAgo, 'yyyy-MM-dd');
        const sales = db.getAllSync(
            `SELECT DISTINCT sale_date FROM daily_sales WHERE customer_id = ? AND sale_date BETWEEN ? AND ?`,
            customerId, sevenDaysAgoString, todayString
        );
        resolve(sales.map(s => s.sale_date));
    });
};

export const getSalesDataForDate = (date) => {
    return new Promise((resolve) => {
        const data = db.getAllSync(
            `SELECT
                c.id as customer_id,
                c.name as customer_name,
                p.id as product_id,
                p.name as product_name,
                p.unit,
                cp.custom_price,
                cp.default_quantity,
                ds.id as sale_id,
                ds.quantity as sale_quantity,
                ds.price_per_unit as sale_price,
                ds.sale_date
             FROM customers c
             LEFT JOIN customer_products cp ON c.id = cp.customer_id
             LEFT JOIN products p ON cp.product_id = p.id
             LEFT JOIN daily_sales ds ON c.id = ds.customer_id AND p.id = ds.product_id AND ds.sale_date = ?
             WHERE c.isActive = 1
             ORDER BY c.name, p.name`,
            date
        );
        resolve(data);
    });
};

// --- Payment Operations ---
export const recordPayment = (customerId, amount, date, notes) => {
    return new Promise((resolve) => {
        const result = db.runSync('INSERT INTO payments (customer_id, amount_paid, payment_date, notes) VALUES (?,?,?,?)', customerId, amount, date, notes);
        resolve(result.lastInsertRowId);
    });
};

export const getPaymentsForCustomer = (customerId, startDate, endDate) => {
    return new Promise((resolve) => {
        const payments = db.getAllSync(
            `SELECT * FROM payments WHERE customer_id = ? AND payment_date BETWEEN ? AND ? ORDER BY payment_date ASC`,
            customerId, startDate, endDate
        );
        resolve(payments);
    });
};

// --- Reporting & Dues ---
export const getTotalDuesForCustomerUpToDate = (customerId, date) => {
    return new Promise((resolve) => {
        const salesResult = db.getFirstSync('SELECT SUM(total_amount) as total FROM daily_sales WHERE customer_id = ? AND sale_date < ?', customerId, date);
        const paymentsResult = db.getFirstSync('SELECT SUM(amount_paid) as total FROM payments WHERE customer_id = ? AND payment_date < ?', customerId, date);
        const totalSales = salesResult?.total || 0;
        const totalPayments = paymentsResult?.total || 0;
        resolve(totalSales - totalPayments);
    });
};

export const getTotalSalesForPeriod = (startDate, endDate) => {
     return new Promise((resolve) => {
        const result = db.getFirstSync('SELECT SUM(total_amount) as total FROM daily_sales WHERE sale_date BETWEEN ? AND ?', startDate, endDate);
        resolve(result?.total || 0);
    });
};

export const getCustomerDues = () => {
     return new Promise((resolve) => {
        const dues = db.getAllSync(
            `SELECT 
                c.id, 
                c.name, 
                (SELECT SUM(total_amount) FROM daily_sales WHERE customer_id = c.id) as total_sales,
                (SELECT SUM(amount_paid) FROM payments WHERE customer_id = c.id) as total_payments
             FROM customers c
             GROUP BY c.id, c.name
             ORDER BY c.name ASC`
        );
        const calculatedDues = dues.map(d => ({
            id: d.id,
            name: d.name,
            total_due: (d.total_sales || 0) - (d.total_payments || 0)
        }));
        resolve(calculatedDues);
    });
};

export const getCustomerDuesForPeriod = (startDate, endDate) => {
     return new Promise((resolve) => {
        const dues = db.getAllSync(
            `SELECT
                c.id,
                c.name,
                (SELECT SUM(total_amount) FROM daily_sales WHERE customer_id = c.id AND sale_date BETWEEN ? AND ?) as period_sales,
                (SELECT SUM(amount_paid) FROM payments WHERE customer_id = c.id AND payment_date BETWEEN ? AND ?) as period_payments
             FROM customers c
             GROUP BY c.id, c.name
             HAVING period_sales > 0 OR period_payments > 0`,
            startDate, endDate, startDate, endDate
        );
        const calculatedDues = dues.map(d => ({
            id: d.id,
            name: d.name,
            period_due: (d.period_sales || 0) - (d.period_payments || 0)
        })).filter(d => d.period_due !== 0);
        resolve(calculatedDues);
    });
};

// --- Backup Operations ---
export const getAllDataForBackup = () => {
    return new Promise((resolve) => {
        const today = new Date();
        const startOfMonthString = format(startOfMonth(today), 'yyyy-MM-dd');
        const todayString = format(today, 'yyyy-MM-dd');

        const customers = db.getAllSync('SELECT * FROM customers');
        const products = db.getAllSync('SELECT * FROM products');
        const sales = db.getAllSync('SELECT * FROM daily_sales WHERE sale_date BETWEEN ? AND ?', startOfMonthString, todayString);
        const payments = db.getAllSync('SELECT * FROM payments WHERE payment_date BETWEEN ? AND ?', startOfMonthString, todayString);
        
        resolve({ customers, products, sales, payments });
    });
};
