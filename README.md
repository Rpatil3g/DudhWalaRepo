# Milkwala Vendor Pro

Milkwala Vendor Pro is a comprehensive and offline-first mobile application designed for milk vendors and dairy shop owners to manage their daily sales and customer accounts efficiently. Built with React Native and Expo, this app digitizes the traditional milk delivery business, eliminating the need for manual record-keeping.

## Features

- **Customer Management:**
  - Add, edit, and view a list of all customers.
  - "Soft delete" functionality to hide customers from active lists while retaining their data for reporting.
  - 10-digit validation for customer phone numbers.

- **Product Management:**
  - A central place to manage all products (e.g., Cow Milk, Buffalo Milk).
  - Ability to set and update the default price for each product.
  - Option to apply a global price change to all existing customers.

- **Daily Sales Entry:**
  - A clear list of all customers, showing their sales status for the current day.
  - A 7-day status indicator on each customer card to quickly see the last week's sales history.
  - An intuitive modal to add or edit a sale for any customer, for any date (past or present).
  - The form automatically checks for existing entries on a given date to prevent duplicates, ensuring only one entry per product per day.

- **Billing & Reporting:**
  - **Dashboard:** A summary screen showing today's sales, this month's total sales, and a list of customers with outstanding dues.
  - **Reports Tab:**
    - Generate a consolidated sales report for any custom date range.
    - View a list of all customers with dues for the selected period.
    - Generate and share individual PDF bills for any customer for the selected period.
    - Download a consolidated PDF report of all customer dues for the selected period.

- **Data Safety:**
  - **Offline First:** The app is fully functional without an internet connection, storing all data locally on the device using SQLite.
  - **Manual Backup:** A feature to create a JSON backup of all customers, products, and the current month's sales, which can be shared and saved to a safe location like Google Drive.

## Tech Stack

- **Framework:** React Native with Expo
- **UI Components:** React Native Paper
- **Navigation:** React Navigation (Stack & Bottom Tabs)
- **Local Database:** `expo-sqlite`
- **File System & Sharing:** `expo-file-system`, `expo-sharing`
- **PDF Generation:** `expo-print`
- **Date Management:** `date-fns`

## Setup and Installation

To run this project locally for development, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd milkwala-vendor-pro
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```
    *or if you use yarn:*
    ```bash
    yarn install
    ```

3.  **Run the application:**
    ```bash
    npx expo start
    ```
    This will start the Metro bundler. You can then run the app on an Android emulator or scan the QR code with the Expo Go app on your physical device.

## Building for Production

To create a standalone `.apk` file that can be installed on any Android device without needing Expo Go:

1.  **Install the EAS CLI:**
    ```bash
    npm install -g eas-cli
    ```

2.  **Log in to your Expo account:**
    ```bash
    eas login
    ```

3.  **Configure the build:**
    ```bash
    eas build:configure
    ```

4.  **Build the APK:**
    ```bash
    eas build --platform android --profile preview
    ```
    Follow the command-line prompts. Once the build is complete, you will get a downloadable link for your `.apk` file.

