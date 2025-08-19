
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, Card, Title, List, Divider, Button } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getTotalSalesForPeriod, getCustomerDuesForPeriod, getSalesForCustomer, getPaymentsForCustomer, getTotalDuesForCustomerUpToDate } from '../db/Database';
import { format, startOfMonth } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const ReportsScreen = () => {
    const [totalSales, setTotalSales] = useState(0);
    const [customerDues, setCustomerDues] = useState([]);
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSettingStartDate, setIsSettingStartDate] = useState(true);

    const loadReports = useCallback(() => {
        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        getTotalSalesForPeriod(formattedStartDate, formattedEndDate)
            .then(setTotalSales)
            .catch(err => console.error("Error getting total sales:", err));

        getCustomerDuesForPeriod(formattedStartDate, formattedEndDate)
            .then(setCustomerDues)
            .catch(err => console.error("Error getting customer dues for period:", err));
    }, [startDate, endDate]);

    useFocusEffect(loadReports);

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || (isSettingStartDate ? startDate : endDate);
        setShowDatePicker(Platform.OS === 'ios');
        if (isSettingStartDate) {
            setStartDate(currentDate);
        } else {
            setEndDate(currentDate);
        }
    };

    const generateDuesReportPDF = async () => {
        let duesRows = customerDues.map(due => `
            <tr>
                <td>${due.name}</td>
                <td style="text-align:right;">₹${due.period_due.toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <html>
                <head><style>body{font-family:sans-serif;padding:20px;} h1,h2{text-align:center;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background-color:#f2f2f2;}</style></head>
                <body>
                    <h1>Customer Dues Report</h1>
                    <h2>Period: ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}</h2>
                    <hr/>
                    <table>
                        <thead><tr><th>Customer Name</th><th style="text-align:right;">Period Due</th></tr></thead>
                        <tbody>
                            ${duesRows.length > 0 ? duesRows : '<tr><td colspan="2" style="text-align:center;">No dues in this period.</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th style="text-align:right;">Grand Total</th>
                                <th style="text-align:right;">₹${totalSales.toFixed(2)}</th>
                            </tr>
                        </tfoot>
                    </table>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert("Sharing not available", "Sharing is not available on your device.");
                return;
            }
            await Sharing.shareAsync(uri, { dialogTitle: 'Share Dues Report', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert("Error", "Could not generate or share PDF report.");
            console.error(error);
        }
    };

    const generateBillPDF = async (customer) => {
        if (!customer) return;

        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        const openingBalance = await getTotalDuesForCustomerUpToDate(customer.id, formattedStartDate);
        const salesForBill = await getSalesForCustomer(customer.id, formattedStartDate, formattedEndDate);
        const paymentsForBill = await getPaymentsForCustomer(customer.id, formattedStartDate, formattedEndDate);

        const salesTotal = salesForBill.reduce((acc, sale) => acc + sale.total_amount, 0);
        const paymentsTotal = paymentsForBill.reduce((acc, p) => acc + p.amount_paid, 0);
        const closingBalance = openingBalance + salesTotal - paymentsTotal;

        const combinedEntries = [
            ...salesForBill.map(s => ({ date: s.sale_date, type: 'sale', data: s })),
            ...paymentsForBill.map(p => ({ date: p.payment_date, type: 'payment', data: p }))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        let entryRows = combinedEntries.map(entry => {
            if (entry.type === 'sale') {
                const sale = entry.data;
                return `<tr><td>${format(new Date(sale.sale_date + 'T00:00:00'), 'dd-MM-yy')}</td><td>${sale.product_name} (${sale.quantity})</td><td style="text-align:right;">₹${sale.total_amount.toFixed(2)}</td></tr>`;
            } else {
                const payment = entry.data;
                return `<tr><td>${format(new Date(payment.payment_date + 'T00:00:00'), 'dd-MM-yy')}</td><td>Payment Received</td><td style="text-align:right;">- ₹${payment.amount_paid.toFixed(2)}</td></tr>`;
            }
        }).join('');

        const htmlContent = `
            <html>
                <head><style>body{font-family:sans-serif;padding:20px;} h1,h2{text-align:center;} table{width:100%;border-collapse:collapse;margin-bottom:20px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background-color:#f2f2f2;} .summary-table td{font-weight:bold;}</style></head>
                <body>
                    <h1>Bill Statement</h1>
                    <h2>${customer.name}</h2>
                    <p><strong>Period:</strong> ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}</p>
                    <hr/>
                    <table><thead><tr><th>Date</th><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
                        <tbody>
                            <tr><td></td><td><strong>Opening Balance</strong></td><td style="text-align:right;"><strong>₹${openingBalance.toFixed(2)}</strong></td></tr>
                            ${entryRows}
                        </tbody>
                    </table>
                    <table class="summary-table">
                        <tr><td>Period Sales</td><td style="text-align:right;">₹${salesTotal.toFixed(2)}</td></tr>
                        <tr><td>Period Payments</td><td style="text-align:right;">- ₹${paymentsTotal.toFixed(2)}</td></tr>
                        <tr><td>Closing Balance</td><td style="text-align:right;">₹${closingBalance.toFixed(2)}</td></tr>
                    </table>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { dialogTitle: 'Share Bill', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert("Error", "Could not generate or share PDF.");
        }
    };

    return (
        <ScrollView style={styles_reports.container}>
            <Card style={styles_reports.card}>
                <Card.Content>
                    <Title>Report for Period</Title>
                    <Button icon="calendar" mode="outlined" onPress={() => { setIsSettingStartDate(true); setShowDatePicker(true); }}>
                        Start Date: {format(startDate, 'dd MMM yyyy')}
                    </Button>
                    <Button icon="calendar" mode="outlined" onPress={() => { setIsSettingStartDate(false); setShowDatePicker(true); }} style={{marginTop: 10}}>
                        End Date: {format(endDate, 'dd MMM yyyy')}
                    </Button>
                    
                    {showDatePicker && (
                        <DateTimePicker
                            testID="reportDatePicker"
                            value={isSettingStartDate ? startDate : endDate}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                        />
                    )}
                    <Button mode="contained" onPress={generateDuesReportPDF} style={{marginTop: 20}}>
                        Download Report
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles_reports.card}>
                <Card.Content>
                    <Title>Sales in Selected Period</Title>
                    <Text style={styles_reports.salesText}>₹{typeof totalSales === 'number' ? totalSales.toFixed(2) : '0.00'}</Text>
                </Card.Content>
            </Card>

            <Card style={styles_reports.card}>
                <Card.Content>
                    <Title>Customer Dues in Selected Period</Title>
                    <List.Section>
                        {customerDues.map(due => (
                            <View key={due.id}>
                                <List.Item
                                    title={due.name}
                                    description={`Period Due: ₹${due.period_due.toFixed(2)}`}
                                    right={() => 
                                        <Button compact onPress={() => generateBillPDF(due)}>
                                            Generate Bill
                                        </Button>
                                    }
                                />
                                <Divider />
                            </View>
                        ))}
                    </List.Section>
                     {customerDues.length === 0 && (
                        <Text>No customer dues in this period.</Text>
                    )}
                </Card.Content>
            </Card>
        </ScrollView>
    );
};

const styles_reports = StyleSheet.create({
    container: { flex: 1, padding: 8, backgroundColor: '#f5f5f5' },
    card: { margin: 8, elevation: 2 },
    salesText: { fontSize: 32, fontWeight: 'bold', color: '#0066cc', marginVertical: 10 },
    dueAmount: { alignSelf: 'center', fontSize: 16, color: 'red', fontWeight: 'bold' }
});

export default ReportsScreen;