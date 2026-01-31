/*
================================================================================
File: src/screens/ReportsScreen.js
Description: Comprehensive Financial Reports with Profit/Loss and Customer Dues.
*** UPDATED: Filtered out customers with 0 dues ***
================================================================================
*/
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
import { Text, Card, Title, List, Divider, Button, Chip, IconButton, useTheme, Surface, TextInput } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { 
    getTotalSalesForPeriod, 
    getTotalExpensesForPeriod, 
    getComprehensiveCustomerDues, 
    getSalesForCustomer, 
    getPaymentsForCustomer, 
    getTotalDuesForCustomerUpToDate 
} from '../db/Database';
import { format, startOfMonth, subDays } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const ReportsScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();

    // Data State
    const [stats, setStats] = useState({ sales: 0, expenses: 0, profit: 0 });
    const [customerReports, setCustomerReports] = useState([]);
    
    // Filter State
    const [filterType, setFilterType] = useState('currentMonth'); // currentMonth, last30, last365, custom
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSettingStartDate, setIsSettingStartDate] = useState(true);

    // Hide default header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const loadReports = useCallback(() => {
        const sDate = format(startDate, 'yyyy-MM-dd');
        const eDate = format(endDate, 'yyyy-MM-dd');

        // Parallel data fetching
        Promise.all([
            getTotalSalesForPeriod(sDate, eDate),
            getTotalExpensesForPeriod(sDate, eDate),
            getComprehensiveCustomerDues(sDate, eDate)
        ]).then(([sales, expenses, customers]) => {
            setStats({
                sales: sales,
                expenses: expenses,
                profit: sales - expenses
            });
            
            // Filter: Only show customers with actual Total Dues (Positive or Negative/Advance)
            // Using > 0.5 to handle potential floating point dust, treating < 0.5 as 0.
            const activeCustomers = customers.filter(c => Math.abs(c.total_due) > 0.5);
            setCustomerReports(activeCustomers);
            
        }).catch(err => console.error("Error loading reports:", err));

    }, [startDate, endDate]);

    useFocusEffect(loadReports);

    // --- Filter Logic ---
    const handleFilterChange = (type) => {
        setFilterType(type);
        const today = new Date();
        
        if (type === 'currentMonth') {
            setStartDate(startOfMonth(today));
            setEndDate(today);
        } else if (type === 'last30') {
            setStartDate(subDays(today, 30));
            setEndDate(today);
        } else if (type === 'last365') {
            setStartDate(subDays(today, 365));
            setEndDate(today);
        }
        // 'custom' does not change dates automatically, waits for user
    };

    // --- PDF Generation: Single Customer (Detailed) ---
    const generateCustomerPDF = async (customer) => {
        try {
            const sDate = format(startDate, 'yyyy-MM-dd');
            const eDate = format(endDate, 'yyyy-MM-dd');

            // Fetch detailed lines for this customer
            const sales = await getSalesForCustomer(customer.id, sDate, eDate);
            const payments = await getPaymentsForCustomer(customer.id, sDate, eDate);
            // openingBalance logic
            const currentTotalDue = customer.total_due; 
            const periodDiff = customer.period_sales - customer.period_payments;
            const computedOpening = currentTotalDue - periodDiff; 

             const htmlContent = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica'; padding: 20px; }
                        h1 { text-align: center; color: #0066cc; }
                        .header { margin-bottom: 20px; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
                        .summary { margin-bottom: 20px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; background-color: #f9f9f9; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #0066cc; color: white; }
                        .total-row { font-weight: bold; background-color: #e6e6e6; }
                        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #777; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Statement of Account</h1>
                        <p><strong>Customer:</strong> ${customer.name}</p>
                        <p><strong>Period:</strong> ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}</p>
                    </div>

                    <div class="summary">
                        <p><strong>Opening Balance:</strong> ₹${computedOpening.toFixed(2)}</p>
                        <p><strong>+ Sales (This Period):</strong> ₹${customer.period_sales.toFixed(2)}</p>
                        <p><strong>- Payments (This Period):</strong> ₹${customer.period_payments.toFixed(2)}</p>
                        <h3>Net Payable: ₹${currentTotalDue.toFixed(2)}</h3>
                    </div>

                    <h3>Sales History</h3>
                    <table>
                        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Total</th></tr></thead>
                        <tbody>
                            ${sales.map(s => `
                                <tr>
                                    <td>${format(new Date(s.sale_date), 'dd MMM')}</td>
                                    <td>${s.product_name}</td>
                                    <td>${s.quantity}</td>
                                    <td>${s.total_amount.toFixed(2)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                    
                    <h3>Payments</h3>
                     <table>
                        <thead><tr><th>Date</th><th>Notes</th><th>Amount</th></tr></thead>
                        <tbody>
                            ${payments.map(p => `
                                <tr>
                                    <td>${format(new Date(p.payment_date), 'dd MMM')}</td>
                                    <td>${p.notes || '-'}</td>
                                    <td>${p.amount_paid.toFixed(2)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>

                    <div class="footer"><p>Generated by Milkwala Vendor Pro</p></div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to generate PDF");
        }
    };

    // --- PDF Generation: All Users (Aggregate) ---
    const generateAllUsersPDF = async () => {
        try {
            // 1. Calculate Grand Totals
            const totalPeriodSales = customerReports.reduce((sum, c) => sum + c.period_sales, 0);
            const totalPeriodPayments = customerReports.reduce((sum, c) => sum + c.period_payments, 0);
            const totalPeriodDue = customerReports.reduce((sum, c) => sum + c.period_due, 0);
            const grandTotalOutstanding = customerReports.reduce((sum, c) => sum + c.total_due, 0);

            const htmlContent = `
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica'; padding: 20px; }
                        h1 { text-align: center; color: #0066cc; }
                        .summary-box { display: flex; justify-content: space-between; margin-bottom: 20px; }
                        .card { border: 1px solid #ddd; padding: 10px; width: 30%; text-align: center; border-radius: 8px; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #0066cc; color: white; }
                        .total-row td { background-color: #e0e0e0; font-weight: bold; border-top: 2px solid #333; }
                    </style>
                </head>
                <body>
                    <h1>Business Financial Report</h1>
                    <p align="center">Period: ${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}</p>

                    <div class="summary-box">
                        <div class="card" style="background-color: #e8f5e9;">
                            <h3>Total Sales</h3>
                            <h2>₹${stats.sales.toLocaleString()}</h2>
                        </div>
                        <div class="card" style="background-color: #ffebee;">
                            <h3>Expenses</h3>
                            <h2>₹${stats.expenses.toLocaleString()}</h2>
                        </div>
                        <div class="card" style="background-color: #e3f2fd;">
                            <h3>Net Profit</h3>
                            <h2 style="color: ${stats.profit >= 0 ? 'green' : 'red'}">₹${stats.profit.toLocaleString()}</h2>
                        </div>
                    </div>

                    <h3>Customer Dues Summary</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Period Sales</th>
                                <th>Period Payments</th>
                                <th>Period Due</th>
                                <th>Total Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${customerReports.map(c => `
                                <tr>
                                    <td>${c.name}</td>
                                    <td>₹${c.period_sales.toFixed(0)}</td>
                                    <td>₹${c.period_payments.toFixed(0)}</td>
                                    <td style="color: ${c.period_due > 0 ? 'red' : 'black'}">₹${c.period_due.toFixed(0)}</td>
                                    <td style="font-weight: bold;">₹${c.total_due.toFixed(0)}</td>
                                </tr>`).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td>TOTALS</td>
                                <td>₹${totalPeriodSales.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                                <td>₹${totalPeriodPayments.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                                <td>₹${totalPeriodDue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                                <td>₹${grandTotalOutstanding.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</td>
                            </tr>
                        </tfoot>
                    </table>
                </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to generate aggregate report");
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.headerTitle}>Financial Reports</Text>
                
                {/* Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
                    <Chip 
                        selected={filterType === 'currentMonth'} 
                        onPress={() => handleFilterChange('currentMonth')} 
                        style={[styles.chip, filterType === 'currentMonth' && { backgroundColor: theme.colors.accent }]} 
                        textStyle={{color: 'black'}}
                    >
                        Current Month
                    </Chip>
                    <Chip 
                        selected={filterType === 'last30'} 
                        onPress={() => handleFilterChange('last30')} 
                        style={[styles.chip, filterType === 'last30' && { backgroundColor: theme.colors.accent }]} 
                        textStyle={{color: 'black'}}
                    >
                        Last 30 Days
                    </Chip>
                    <Chip 
                        selected={filterType === 'last365'} 
                        onPress={() => handleFilterChange('last365')} 
                        style={[styles.chip, filterType === 'last365' && { backgroundColor: theme.colors.accent }]} 
                        textStyle={{color: 'black'}}
                    >
                        Last Year
                    </Chip>
                    <Chip 
                        selected={filterType === 'custom'} 
                        onPress={() => handleFilterChange('custom')} 
                        style={[styles.chip, filterType === 'custom' && { backgroundColor: theme.colors.accent }]} 
                        textStyle={{color: 'black'}}
                    >
                        Custom
                    </Chip>
                </ScrollView>

                {/* Date Display */}
                <View style={styles.dateRow}>
                     <TouchableOpacity onPress={() => { setIsSettingStartDate(true); setShowDatePicker(true); setFilterType('custom'); }}>
                        <Surface style={styles.dateBadge} elevation={2}>
                            <Icon name="calendar" size={16} color={theme.colors.primary} />
                            <Text style={styles.dateText}>{format(startDate, 'dd MMM yy')}</Text>
                        </Surface>
                    </TouchableOpacity>
                    <Text style={{color: 'white', marginHorizontal: 8}}>-</Text>
                    <TouchableOpacity onPress={() => { setIsSettingStartDate(false); setShowDatePicker(true); setFilterType('custom'); }}>
                         <Surface style={styles.dateBadge} elevation={2}>
                            <Icon name="calendar" size={16} color={theme.colors.primary} />
                            <Text style={styles.dateText}>{format(endDate, 'dd MMM yy')}</Text>
                        </Surface>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* Profit/Loss Card */}
                <Surface style={styles.summaryCard} elevation={2}>
                    <Title style={styles.cardTitle}>Profit & Loss Summary</Title>
                    <Divider style={{marginBottom: 10}}/>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Total Sales</Text>
                            <Text style={[styles.statValue, {color: '#2e7d32'}]}>₹{stats.sales.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.verticalDivider, {backgroundColor: '#eee'}]} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Expenses</Text>
                            <Text style={[styles.statValue, {color: '#d32f2f'}]}>₹{stats.expenses.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.verticalDivider, {backgroundColor: '#eee'}]} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Net Profit</Text>
                            <Text style={[styles.statValue, {color: stats.profit >= 0 ? theme.colors.primary : '#d32f2f'}]}>
                                ₹{stats.profit.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </Surface>

                {/* Aggregate Download Button */}
                <Button 
                    mode="contained" 
                    icon="file-download" 
                    onPress={generateAllUsersPDF} 
                    style={styles.downloadBtn}
                    labelStyle={{fontSize: 16}}
                >
                    Download Full Report
                </Button>

                {/* Customer Dues List */}
                <View style={styles.listHeader}>
                    <Title style={{fontSize: 18}}>Customer Dues</Title>
                </View>

                {customerReports.map((item) => (
                    <Surface key={item.id} style={styles.customerCard} elevation={1}>
                        <View style={styles.customerRow}>
                            <View style={{flex: 1}}>
                                <Text style={styles.customerName}>{item.name}</Text>
                                <View style={styles.duesRow}>
                                    <Text style={styles.totalDue}>Total Due: ₹{item.total_due.toLocaleString()}</Text>
                                    {/* Show Period Due only if significantly different from Total Due (e.g., > 1 diff to ignore floats) */}
                                    {Math.abs(item.total_due - item.period_due) > 1 && (
                                        <Text style={styles.periodDue}>
                                            (Period: {item.period_due > 0 ? '+' : ''}₹{item.period_due.toLocaleString()})
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <IconButton 
                                icon="whatsapp" 
                                color="white" 
                                size={24}
                                style={{backgroundColor: '#25D366'}}
                                onPress={() => generateCustomerPDF(item)}
                            />
                        </View>
                    </Surface>
                ))}
                
                {customerReports.length === 0 && (
                    <Text style={styles.emptyText}>No customer dues found for this period.</Text>
                )}

            </ScrollView>

            {showDatePicker && (
                <DateTimePicker
                    value={isSettingStartDate ? startDate : endDate}
                    mode="date"
                    onChange={(e, date) => {
                        setShowDatePicker(false);
                        if (date) {
                            if (isSettingStartDate) setStartDate(date);
                            else setEndDate(date);
                            setFilterType('custom');
                        }
                    }}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    headerBg: {
        paddingTop: 50,
        paddingBottom: 20,
        backgroundColor: '#0066cc',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 4
    },
    headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
    
    filterContainer: { paddingHorizontal: 16, marginBottom: 12 },
    chip: { marginRight: 8, backgroundColor: 'white' },
    
    dateRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    dateBadge: { 
        flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'white' 
    },
    dateText: { marginLeft: 6, fontWeight: '600', color: '#333' },

    scrollContent: { padding: 16, paddingBottom: 40 },

    // Summary Card
    summaryCard: { borderRadius: 12, padding: 16, backgroundColor: 'white', marginBottom: 20 },
    cardTitle: { fontSize: 16, color: '#666', marginBottom: 8, textAlign: 'center' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { alignItems: 'center', flex: 1 },
    statLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: 'bold' },
    verticalDivider: { width: 1, height: '80%', alignSelf: 'center' },

    downloadBtn: { marginBottom: 20, borderRadius: 8, paddingVertical: 4 },

    listHeader: { marginBottom: 10 },
    
    // Customer Card
    customerCard: { borderRadius: 10, padding: 12, backgroundColor: 'white', marginBottom: 10 },
    customerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    customerName: { fontSize: 15,  color: '#333' },
    duesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
    totalDue: { fontSize: 14, color: '#d32f2f', marginRight: 8 },
    periodDue: { fontSize: 12, color: '#666' },

    emptyText: { textAlign: 'center', color: '#aaa', marginTop: 20, fontStyle: 'italic' }
});

export default ReportsScreen;