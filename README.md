# Milkwala Vendor Pro

Milkwala Vendor Pro is a comprehensive, offline-first mobile application designed for milk vendors and dairy shop owners to manage their daily sales, customer accounts, payments, and business expenses efficiently. Built with React Native and Expo, this app digitizes the traditional milk delivery business, eliminating the need for manual record-keeping.

## Features

### Customer Management
- Add, edit, and view a list of all customers with search functionality.
- "Soft delete" to hide inactive customers while retaining their historical data.
- 10-digit phone number validation.
- Quick-dial and SMS shortcuts from the customer detail screen.

### Product Management
- Central product inventory to manage all products (e.g., Cow Milk, Buffalo Milk).
- Set and update the default price for each product globally.
- Option to apply a global price change to all existing customers at once.
- Assign products to individual customers with custom per-customer pricing and default quantities.

### Daily Sales Entry
- Customer list showing each customer's sales status for the current day.
- 7-day status indicator circles on each customer card (green = sale recorded, gray = no sale).
- "Add Entry" / "Recorded" badge toggle for quick visual status at a glance.
- Intuitive modal to add or edit a sale for any customer for any date (past or present).
- Pre-populated quantity (from last sale) and rate (from current product config) for faster entry.
- Automatic duplicate prevention — one entry per product per day per customer.

### Payment Tracking
- Record customer payments with amount, date, and optional notes.
- View complete payment history per customer (last 30 days).
- Outstanding due calculation per customer (total sales minus total payments).

### Expense Tracking
- Record business expenses with amount, category, date, and custom notes.
- Support for custom expense categories.
- Month-by-month expense navigation with totals.
- Edit and delete expenses directly from the list.

### Dashboard
- Hero card showing today's total collection.
- Quick action buttons: New Customer, Record Sale, Add Expense, Backup.
- Monthly health overview: total income, total expenses, expense ratio bar, and net profit.
- Previous months' history cards for trend tracking.
- Top 5 customers with outstanding dues.
- Pull-to-refresh to reload all stats.

### Billing & Reports
- Date range filters: Current Month, Last 30 Days, Last 365 Days, or Custom Range.
- Sales, expenses, and net profit summary for any period.
- Customer dues report listing all customers with outstanding balances.
- Generate and share individual PDF bills per customer for a selected date range.
- Download a consolidated PDF report of all customer dues.

### Data Safety
- **Offline First:** Fully functional without an internet connection — all data stored locally using SQLite.
- **Manual Backup:** Create a JSON backup of all customers, products, sales, payments, and expenses; share it to Google Drive or any cloud storage.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native with Expo (~54) |
| UI Components | React Native Paper v5 |
| Navigation | React Navigation v7 (Stack + Bottom Tabs) |
| Local Database | `expo-sqlite` v16 |
| File System & Sharing | `expo-file-system`, `expo-sharing` |
| PDF Generation | `expo-print` |
| Date Utilities | `date-fns` v4 |
| Testing | Jest + React Native Testing Library |

## App Structure

```
src/
├── db/
│   └── Database.js          # All SQLite CRUD operations
└── screens/
    ├── DashboardScreen.js
    ├── CustomersScreen.js
    ├── CustomerDetailScreen.js
    ├── AddEditCustomerScreen.js
    ├── ManageProductsScreen.js       # Per-customer product assignment
    ├── ManageGlobalProductsScreen.js # Global product inventory
    ├── ExpensesScreen.js
    └── ReportsScreen.js
```

## Database Schema

```
customers           → id, name, address, phone, isActive
products            → id, name, unit, default_price
customer_products   → customer_id, product_id, custom_price, default_quantity
daily_sales         → id, customer_id, product_id, quantity, price_per_unit, total_amount, sale_date
payments            → id, customer_id, amount_paid, payment_date, notes
expenses            → id, amount, category, note, expense_date
```

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd DudhWalaRepo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the application:**
   ```bash
   npx expo start
   ```
   This starts the Metro bundler. Run the app on an Android/iOS emulator or scan the QR code with the Expo Go app on your device.

4. **Run tests:**
   ```bash
   npm test
   ```

## Building for Production

To create a standalone `.apk` installable on any Android device:

1. **Install the EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Log in to your Expo account:**
   ```bash
   eas login
   ```

3. **Build the APK:**
   ```bash
   eas build --platform android --profile preview
   ```
   Once the build completes, you'll receive a downloadable link for the `.apk` file.

For a production store build:
```bash
eas build --platform android --profile production
```
