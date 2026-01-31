/*
================================================================================
File: src/screens/CustomerDetailScreen.js
Description: Detailed view of a customer with history, payment entry, and billing.
*** UPDATED: Enhanced Statement Dialog with Date Filters & Better Visibility ***
================================================================================
*/
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { Text, Button, Card, List, Divider, useTheme, IconButton, TextInput, Avatar, Surface, Menu, Chip } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getCustomerById, getCustomerProducts, getSalesForCustomer, getPaymentsForCustomer, getTotalDuesForCustomerUpToDate, recordPayment, deleteCustomer } from '../db/Database';
import { format, startOfMonth, parseISO } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const CustomerDetailScreen = () => {
    const [customer, setCustomer] = useState(null);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [payments, setPayments] = useState([]);
    const [totalDue, setTotalDue] = useState(0);
    const navigation = useNavigation();
    const route = useRoute();
    const theme = useTheme();
    const { customerId } = route.params;

    // Menu State
    const [menuVisible, setMenuVisible] = useState(false);

    // State for payment modal
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date());
    const [paymentNotes, setPaymentNotes] = useState('');
    const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);

    // State for Bill Generation
    const [billModalVisible, setBillModalVisible] = useState(false);
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(new Date());
    const [showBillDatePicker, setShowBillDatePicker] = useState(false);
    const [isSettingStartDate, setIsSettingStartDate] = useState(true);
    const [billFilter, setBillFilter] = useState('currentMonth'); // 'currentMonth', 'last30', 'custom'

    // Hide default header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const loadData = useCallback(() => {
        getCustomerById(customerId).then(setCustomer);
        getCustomerProducts(customerId).then(setProducts);

        // Load recent history (last 30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');

        getSalesForCustomer(customerId, startStr, endStr).then(data => {
            // Sort by date descending (newest first)
            const sortedSales = [...data].sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
            setSales(sortedSales);
        });
        
        getPaymentsForCustomer(customerId, startStr, endStr).then(data => {
            // Sort by date descending (newest first)
            const sortedPayments = [...data].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
            setPayments(sortedPayments);
        });
        
        // Calculate Total Due (Overall)
        const futureDate = format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd');
        getTotalDuesForCustomerUpToDate(customerId, futureDate).then(setTotalDue);

    }, [customerId]);

    useFocusEffect(loadData);

    const handleCall = () => {
        if (customer?.phone) Linking.openURL(`tel:${customer.phone}`);
        else Alert.alert("No Phone", "No phone number available for this customer.");
    };

    const handleMessage = () => {
        if (customer?.phone) Linking.openURL(`sms:${customer.phone}`);
        else Alert.alert("No Phone", "No phone number available for this customer.");
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Customer",
            "Are you sure? This will delete all sales and payment history for this customer.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: () => {
                        deleteCustomer(customerId)
                            .then(() => navigation.goBack())
                            .catch(err => console.error(err));
                    } 
                }
            ]
        );
    };

    // --- Filter Logic for Bill ---
    const handleBillFilterChange = (type) => {
        setBillFilter(type);
        const today = new Date();
        if (type === 'currentMonth') {
            setStartDate(startOfMonth(today));
            setEndDate(today);
        } else if (type === 'last30') {
            const start = new Date();
            start.setDate(today.getDate() - 30);
            setStartDate(start);
            setEndDate(today);
        }
        // 'custom' maintains current selection or waits for manual input
    };

    const handleRecordPayment = () => {
        if (!paymentAmount) {
            Alert.alert("Error", "Please enter amount");
            return;
        }
        const dateStr = format(paymentDate, 'yyyy-MM-dd');
        recordPayment(customerId, parseFloat(paymentAmount), dateStr, paymentNotes)
            .then(() => {
                setPaymentModalVisible(false);
                setPaymentAmount('');
                setPaymentNotes('');
                loadData();
                Alert.alert("Success", "Payment Recorded!");
            })
            .catch(console.error);
    };

    const generateBillPDF = async () => {
        try {
            const formattedStartDate = format(startDate, 'yyyy-MM-dd');
            const formattedEndDate = format(endDate, 'yyyy-MM-dd');
            
            const periodSales = await getSalesForCustomer(customerId, formattedStartDate, formattedEndDate);
            const periodPayments = await getPaymentsForCustomer(customerId, formattedStartDate, formattedEndDate);
            const previousDues = await getTotalDuesForCustomerUpToDate(customerId, formattedStartDate);

            const totalSalesAmount = periodSales.reduce((sum, sale) => sum + sale.total_amount, 0);
            const totalPaymentsAmount = periodPayments.reduce((sum, payment) => sum + payment.amount_paid, 0);
            const netPayable = previousDues + totalSalesAmount - totalPaymentsAmount;

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
                        <p><strong>Date Range:</strong> ${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}</p>
                    </div>

                    <div class="summary">
                        <p><strong>Opening Balance:</strong> ₹${previousDues.toFixed(2)}</p>
                        <p><strong>Total Sales:</strong> ₹${totalSalesAmount.toFixed(2)}</p>
                        <p><strong>Total Payments:</strong> ₹${totalPaymentsAmount.toFixed(2)}</p>
                        <h3 style="color: ${netPayable > 0 ? 'red' : 'green'};">Net Payable: ₹${netPayable.toFixed(2)}</h3>
                    </div>

                    <h3>Sales History</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Rate</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${periodSales.map(sale => `
                                <tr>
                                    <td>${format(new Date(sale.sale_date), 'dd MMM')}</td>
                                    <td>${sale.product_name}</td>
                                    <td>${sale.quantity}</td>
                                    <td>${sale.price_per_unit}</td>
                                    <td>${sale.total_amount.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <h3>Payments</h3>
                     <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Notes</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${periodPayments.map(p => `
                                <tr>
                                    <td>${format(new Date(p.payment_date), 'dd MMM')}</td>
                                    <td>${p.notes || '-'}</td>
                                    <td>${p.amount_paid.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        <p>Generated by Milkwala Vendor Pro</p>
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert("Error", "Sharing is not available");
                return;
            }
            await Sharing.shareAsync(uri);
            setBillModalVisible(false);

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to generate PDF");
        }
    };

    if (!customer) return <View style={styles.container}><Text style={{padding: 20}}>Loading...</Text></View>;

    const initials = customer.name.substring(0, 2).toUpperCase();

    return (
        <View style={styles.container}>
            {/* Custom Header */}
            <View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]}>
                <IconButton icon="arrow-left" iconColor="white" onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Customer Details</Text>
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={<IconButton icon="dots-vertical" iconColor="white" onPress={() => setMenuVisible(true)} />}
                >
                    <Menu.Item onPress={() => { setMenuVisible(false); navigation.navigate('Customers', { screen: 'AddEditCustomer', params: { customerId: customer.id } }); }} title="Edit Details" />
                    <Menu.Item onPress={() => { setMenuVisible(false); handleDelete(); }} title="Delete Customer" titleStyle={{color: 'red'}} />
                </Menu>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Hero Profile Card */}
                <Surface style={styles.heroCard} elevation={3}>
                    <View style={styles.profileRow}>
                        <Avatar.Text 
                            size={64} 
                            label={initials} 
                            style={{ backgroundColor: theme.colors.primary }} 
                            labelStyle={{fontSize: 24, fontWeight: 'bold'}}
                        />
                        <View style={styles.profileInfo}>
                            <Text variant="titleLarge" style={styles.profileName}>{customer.name}</Text>
                            <View style={styles.contactRow}>
                                <Icon name="phone" size={14} color="#666" />
                                <Text style={styles.profilePhone}>{customer.phone || "No Phone"}</Text>
                            </View>
                            <View style={styles.contactRow}>
                                <Icon name="map-marker" size={14} color="#666" />
                                <Text style={styles.profileAddress} numberOfLines={1}>{customer.address || "No Address"}</Text>
                            </View>
                        </View>
                        <View style={styles.dueContainer}>
                            <Text style={styles.dueLabel}>Total Due</Text>
                            <Text style={[styles.dueAmount, { color: totalDue > 0 ? '#d32f2f' : '#2e7d32' }]}>
                                ₹{totalDue.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                    
                    <Divider style={{ marginVertical: 8 }} />
                    
                    <View style={styles.actionRow}>
                        <Button icon="phone" mode="text" onPress={handleCall} compact>Call</Button>
                        <Button icon="message-text" mode="text" onPress={handleMessage} compact>Message</Button>
                    </View>
                </Surface>

                {/* Quick Actions Grid */}
                <View style={styles.quickActionsContainer}>
                    <Button 
                        mode="contained" 
                        icon="cash-plus" 
                        onPress={() => setPaymentModalVisible(true)}
                        style={styles.primaryActionBtn}
                        contentStyle={{ height: 48 }}
                    >
                        Record Payment
                    </Button>
                    <View style={{flexDirection: 'row', marginTop: 10, justifyContent: 'space-between'}}>
                        <Button 
                            mode="outlined" 
                            icon="package-variant" 
                            onPress={() => navigation.navigate('Customers', { screen: 'ManageProducts', params: { customerId: customer.id } })}
                            style={[styles.secondaryActionBtn, {marginRight: 8}]}
                        >
                            Products
                        </Button>
                        <Button 
                            mode="outlined" 
                            icon="file-document-outline" 
                            onPress={() => { setBillModalVisible(true); handleBillFilterChange('currentMonth'); }}
                            style={[styles.secondaryActionBtn, {marginLeft: 8}]}
                        >
                            Statement
                        </Button>
                    </View>
                </View>

                {/* Recent History Section */}
                <View style={styles.sectionHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Assigned Products</Text>
                </View>
                <Card style={styles.card}>
                    <Card.Content>
                        {products.length > 0 ? products.map(p => (
                            <View key={p.id} style={styles.productRow}>
                                <Text style={styles.productName}>{p.name}</Text>
                                <Text style={styles.productDetails}>{p.default_quantity} {p.unit} @ ₹{p.custom_price}</Text>
                            </View>
                        )) : <Text style={{color: '#888', fontStyle: 'italic'}}>No products assigned yet.</Text>}
                    </Card.Content>
                </Card>


                <View style={styles.sectionHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Recent Payments (Last 30 Days)</Text>
                </View>
                <Card style={styles.card}>
                    {payments.map((pay, index) => (
                        <View key={pay.id}>
                            <List.Item
                                title={format(new Date(pay.payment_date), 'dd MMM yyyy')}
                                titleStyle={{ fontSize: 15 }}
                                description={pay.notes ? `Note: ${pay.notes}` : 'Payment Received'}
                                right={() => <Text style={styles.paymentAmount}>- ₹{pay.amount_paid}</Text>}
                                left={() => (
                                    <Icon 
                                        name="cash-check" 
                                        size={24} 
                                        color="#2e7d32" 
                                        style={styles.listItemIcon} 
                                    />
                                )}
                            />
                            {index < payments.length - 1 && <Divider />}
                        </View>
                    ))}
                    {payments.length === 0 && <Text style={styles.emptyText}>No recent payments.</Text>}
                </Card>
                
                <View style={styles.sectionHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Recent Sales (Last 30 Days)</Text>
                </View>
                <Card style={styles.card}>
                    {sales.map((sale, index) => (
                        <View key={sale.id}>
                            <List.Item
                                title={format(new Date(sale.sale_date), 'dd MMM yyyy')}
                                titleStyle={{ fontSize: 15 }}
                                description={`${sale.product_name} - ${sale.quantity} unit(s)`}
                                right={() => <Text style={styles.saleAmount}>₹{sale.total_amount}</Text>}
                                left={() => (
                                    <Icon 
                                        name="water" 
                                        size={24} 
                                        color={theme.colors.primary} 
                                        style={styles.listItemIcon} 
                                    />
                                )}
                            />
                            {index < sales.length - 1 && <Divider />}
                        </View>
                    ))}
                    {sales.length === 0 && <Text style={styles.emptyText}>No recent sales.</Text>}
                </Card>


            </ScrollView>

            {/* --- Modals --- */}

            {/* Payment Modal */}
            <Modal visible={paymentModalVisible} transparent animationType="slide" onRequestClose={() => setPaymentModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        <Card.Title title="Record Payment" right={(props) => <IconButton {...props} icon="close" onPress={() => setPaymentModalVisible(false)} />} />
                        <Card.Content>
                            <TextInput
                                label="Amount (₹)"
                                value={paymentAmount}
                                onChangeText={setPaymentAmount}
                                keyboardType="numeric"
                                mode="outlined"
                                style={styles.input}
                            />
                            <Button mode="outlined" onPress={() => setShowPaymentDatePicker(true)} style={styles.dateBtn}>
                                Date: {format(paymentDate, 'dd MMM yyyy')}
                            </Button>
                            <TextInput
                                label="Notes (Optional)"
                                value={paymentNotes}
                                onChangeText={setPaymentNotes}
                                mode="outlined"
                                style={styles.input}
                            />
                            <Button mode="contained" onPress={handleRecordPayment} style={styles.modalBtn}>
                                Save Payment
                            </Button>
                        </Card.Content>
                    </Card>
                </View>
            </Modal>
            {showPaymentDatePicker && (
                <DateTimePicker
                    value={paymentDate}
                    mode="date"
                    onChange={(e, date) => { setShowPaymentDatePicker(false); if(date) setPaymentDate(date); }}
                />
            )}

            {/* Bill Generation Modal */}
            <Modal visible={billModalVisible} transparent animationType="slide" onRequestClose={() => setBillModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        <Card.Title title="Generate Statement" right={(props) => <IconButton {...props} icon="close" onPress={() => setBillModalVisible(false)} />} />
                        <Card.Content>
                            
                            {/* Filter Chips */}
                            <View style={styles.filterRow}>
                                <Chip 
                                    selected={billFilter === 'currentMonth'} 
                                    onPress={() => handleBillFilterChange('currentMonth')} 
                                    style={styles.chip}
                                    showSelectedOverlay
                                >
                                    Current Month
                                </Chip>
                                <Chip 
                                    selected={billFilter === 'last30'} 
                                    onPress={() => handleBillFilterChange('last30')} 
                                    style={styles.chip}
                                    showSelectedOverlay
                                >
                                    Last 30 Days
                                </Chip>
                                <Chip 
                                    selected={billFilter === 'custom'} 
                                    onPress={() => handleBillFilterChange('custom')} 
                                    style={styles.chip}
                                    showSelectedOverlay
                                >
                                    Custom
                                </Chip>
                            </View>

                            <Divider style={{marginVertical: 12}} />

                            {/* Clearer Date Selection with TextInputs */}
                            <View style={styles.dateRow}>
                                <TouchableOpacity 
                                    style={{flex:1, marginRight: 5}} 
                                    onPress={() => { setIsSettingStartDate(true); setShowBillDatePicker(true); }}
                                >
                                    <TextInput
                                        label="From Date"
                                        value={format(startDate, 'dd MMM yyyy')}
                                        mode="outlined"
                                        editable={false}
                                        pointerEvents="none" 
                                        right={<TextInput.Icon icon="calendar" />}
                                        style={{backgroundColor: 'white', fontSize: 15}}
                                    />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={{flex:1, marginLeft: 5}} 
                                    onPress={() => { setIsSettingStartDate(false); setShowBillDatePicker(true); }}
                                >
                                    <TextInput
                                        label="To Date"
                                        value={format(endDate, 'dd MMM yyyy')}
                                        mode="outlined"
                                        editable={false}
                                        pointerEvents="none"
                                        right={<TextInput.Icon icon="calendar" />}
                                        style={{backgroundColor: 'white', fontSize: 15}}
                                    />
                                </TouchableOpacity>
                            </View>

                            <Button mode="contained" icon="file-pdf-box" onPress={generateBillPDF} style={styles.modalBtn}>
                                Generate PDF
                            </Button>
                        </Card.Content>
                    </Card>
                </View>
            </Modal>
            {showBillDatePicker && (
                <DateTimePicker
                    value={isSettingStartDate ? startDate : endDate}
                    mode="date"
                    onChange={(e, date) => {
                        setShowBillDatePicker(false);
                        if (date) {
                            if (isSettingStartDate) setStartDate(date);
                            else setEndDate(date);
                            setBillFilter('custom'); // Automatically switch to Custom if user picks a date manually
                        }
                    }}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    headerBg: {
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 4
    },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', flex: 1, textAlign: 'center', marginRight: 40 },
    scrollContent: { paddingBottom: 40 },

    // Hero Card
    heroCard: { margin: 16, marginTop: -15, padding: 16, borderRadius: 12, backgroundColor: 'white' },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    profileInfo: { flex: 1, marginLeft: 16 },
    profileName: { fontWeight: 'bold', color: '#333' },
    contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    profilePhone: { color: '#666', marginLeft: 6, fontSize: 14 },
    profileAddress: { color: '#666', marginLeft: 6, fontSize: 13, flex: 1 },
    
    dueContainer: { alignItems: 'flex-end', justifyContent: 'center' },
    dueLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase' },
    dueAmount: { fontSize: 22, fontWeight: 'bold' },

    actionRow: { flexDirection: 'row', justifyContent: 'space-evenly' },

    // Quick Actions
    quickActionsContainer: { paddingHorizontal: 16, marginBottom: 20 },
    primaryActionBtn: { borderRadius: 8, elevation: 2 },
    secondaryActionBtn: { flex: 1, borderRadius: 8, borderColor: '#ccc' },

    // Lists
    sectionHeader: { paddingHorizontal: 16, marginBottom: 8 },
    sectionTitle: { fontWeight: 'bold', color: '#444' },
    card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 12, backgroundColor: 'white', elevation: 1 },
    productRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    productName: { fontSize: 16, fontWeight: '500' },
    productDetails: { color: '#666' },
    
    // Adjusted icon alignment
    listItemIcon: { alignSelf: 'center', marginLeft: 10, marginRight: -10 },
    saleAmount: { fontSize: 15, fontWeight: 'bold', color: '#333', alignSelf: 'center' },
    paymentAmount: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32', alignSelf: 'center' },
    emptyText: { padding: 16, textAlign: 'center', color: '#888', fontStyle: 'italic' },

    // Modals
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalCard: { width: '90%', borderRadius: 12, backgroundColor: 'white' }, // Increased width slightly for filters
    input: { marginBottom: 12 },
    dateBtn: { marginBottom: 16 },
    modalBtn: { marginTop: 8 },
    dateRow: { flexDirection: 'row', marginBottom: 20 },
    
    // Filter Styles
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 5 },
    chip: { marginRight: 6, marginBottom: 6 },
});

export default CustomerDetailScreen;