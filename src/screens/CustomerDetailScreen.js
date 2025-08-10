import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, ScrollView, Modal, Platform } from 'react-native';
import { Text, Button, Card, Title, Paragraph, List, Divider, useTheme, IconButton } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getCustomerById, getCustomerProducts, getSalesForCustomer, getCustomerDues, deleteCustomer } from '../db/Database';
import { format, startOfMonth } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';

const CustomerDetailScreen = () => {
    const [customer, setCustomer] = useState(null);
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [totalDue, setTotalDue] = useState(0);
    const navigation = useNavigation();
    const route = useRoute();
    const theme = useTheme();
    const { customerId } = route.params;

    // State for bill generation modal
    const [billModalVisible, setBillModalVisible] = useState(false);
    const [startDate, setStartDate] = useState(startOfMonth(new Date()));
    const [endDate, setEndDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSettingStartDate, setIsSettingStartDate] = useState(true);

    const loadData = useCallback(() => {
        getCustomerById(customerId).then(setCustomer);
        getCustomerProducts(customerId).then(setProducts);
        
        getCustomerDues().then(dues => {
            const customerDue = dues.find(d => d.id === customerId);
            setTotalDue(customerDue ? customerDue.total_due : 0);
        });

        const recentEndDate = format(new Date(), 'yyyy-MM-dd');
        const recentStartDate = format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd');
        getSalesForCustomer(customerId, recentStartDate, recentEndDate).then(setSales);
    }, [customerId]);

    useFocusEffect(loadData);

    const handleDelete = () => {
        Alert.alert(
            "Delete Customer",
            `Are you sure you want to delete ${customer.name}? This will hide them from the list but preserve their sales history. This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        deleteCustomer(customerId)
                            .then(() => {
                                Alert.alert("Success", `${customer.name} has been deleted.`);
                                navigation.goBack();
                            })
                            .catch(err => {
                                Alert.alert("Error", "Could not delete customer.");
                                console.error(err);
                            });
                    }
                }
            ]
        );
    };

    const generateBillPDF = async () => {
        if (!customer) return;

        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        const salesForBill = await getSalesForCustomer(customerId, formattedStartDate, formattedEndDate);

        let salesRows = salesForBill.map(sale => `
            <tr>
                <td>${format(new Date(sale.sale_date + 'T00:00:00'), 'dd-MM-yyyy')}</td>
                <td>${sale.product_name}</td>
                <td>${sale.quantity.toFixed(2)}</td>
                <td>₹${sale.price_per_unit.toFixed(2)}</td>
                <td>₹${sale.total_amount.toFixed(2)}</td>
            </tr>
        `).join('');

        const billTotal = salesForBill.reduce((acc, sale) => acc + sale.total_amount, 0);

        const htmlContent = `
            <html>
                <head><style>body{font-family:sans-serif;padding:20px;} h1,h2{text-align:center;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background-color:#f2f2f2;}</style></head>
                <body>
                    <h1>Milk Bill</h1>
                    <h2>${customer.name}</h2>
                    <p><strong>Bill Period:</strong> ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}</p>
                    <hr/>
                    <h3>Sales Details</h3>
                    <table>
                        <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                        <tbody>${salesRows.length > 0 ? salesRows : '<tr><td colspan="5" style="text-align:center;">No sales in this period.</td></tr>'}</tbody>
                    </table>
                    <h3 style="text-align:right;margin-top:20px;">Period Total: ₹${billTotal.toFixed(2)}</h3>
                    <h3 style="text-align:right;">Total Outstanding Due: ₹${totalDue ? totalDue.toFixed(2) : '0.00'}</h3>
                </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert("Sharing not available", "Sharing is not available on your device.");
                return;
            }
            await Sharing.shareAsync(uri, { dialogTitle: 'Share Bill', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert("Error", "Could not generate or share PDF.");
            console.error(error);
        } finally {
            setBillModalVisible(false);
        }
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || (isSettingStartDate ? startDate : endDate);
        setShowDatePicker(Platform.OS === 'ios');
        if (isSettingStartDate) {
            setStartDate(currentDate);
        } else {
            setEndDate(currentDate);
        }
    };

    if (!customer) {
        return <View style={styles_details.container}><Text>Loading...</Text></View>;
    }

    return (
        <ScrollView style={styles_details.container}>
            <Card style={styles_details.card}>
                <Card.Content>
                    <Title>{customer.name}</Title>
                    <Paragraph>{customer.address}</Paragraph>
                    <Paragraph>{customer.phone}</Paragraph>
                    <Title style={styles_details.dueText}>Total Due: ₹{totalDue ? totalDue.toFixed(2) : '0.00'}</Title>
                </Card.Content>
                <Card.Actions style={styles_details.actions}>
                    <Button onPress={() => navigation.navigate('AddEditCustomer', { customerId: customer.id })}>Edit</Button>
                    <Button onPress={() => setBillModalVisible(true)}>Generate Bill</Button>
                    <Button color={theme.colors.error} onPress={handleDelete}>Delete</Button>
                </Card.Actions>
            </Card>

            <Card style={styles_details.card}>
                <Card.Content>
                    <Title>Subscribed Products</Title>
                    <List.Section>
                        {products.length > 0 ? products.map(p => (
                            <List.Item
                                key={p.id}
                                title={`${p.name} (${p.default_quantity} ${p.unit})`}
                                description={`Price: ₹${p.custom_price.toFixed(2)} per ${p.unit}`}
                                left={() => <List.Icon icon="basket" />}
                            />
                        )) : <Text>No products assigned.</Text>}
                    </List.Section>
                    <Button onPress={() => navigation.navigate('ManageProducts', { customerId: customer.id })}>Manage Products</Button>
                </Card.Content>
            </Card>

            <Card style={styles_details.card}>
                <Card.Content>
                    <Title>Recent Sales (Last 30 Days)</Title>
                    <List.Section>
                        {sales.map(s => (
                            <View key={s.id}>
                                <List.Item
                                    title={`${s.product_name} - ${s.quantity} ${products.find(p=>p.id===s.product_id)?.unit || ''}`}
                                    description={`On ${format(new Date(s.sale_date + 'T00:00:00'), 'dd MMM yyyy')}`}
                                    right={() => <Text style={styles_details.listItemRight}>₹{s.total_amount.toFixed(2)}</Text>}
                                />
                                <Divider />
                            </View>
                        ))}
                         {sales.length === 0 && <Text>No recent sales.</Text>}
                    </List.Section>
                </Card.Content>
            </Card>

            <Modal
                animationType="slide"
                transparent={true}
                visible={billModalVisible}
                onRequestClose={() => setBillModalVisible(false)}
            >
                <View style={styles_details.modalContainer}>
                    <Card style={styles_details.modalCard}>
                        <Card.Title
                            title="Generate Bill"
                            subtitle="Select a date range"
                            right={(props) => <IconButton {...props} icon="close" onPress={() => setBillModalVisible(false)} />}
                        />
                        <Card.Content>
                            <Button icon="calendar" mode="outlined" onPress={() => { setIsSettingStartDate(true); setShowDatePicker(true); }}>
                                Start Date: {format(startDate, 'dd MMM yyyy')}
                            </Button>
                            <Button icon="calendar" mode="outlined" onPress={() => { setIsSettingStartDate(false); setShowDatePicker(true); }} style={{marginTop: 10}}>
                                End Date: {format(endDate, 'dd MMM yyyy')}
                            </Button>
                            
                            {showDatePicker && (
                                <DateTimePicker
                                    testID="billDatePicker"
                                    value={isSettingStartDate ? startDate : endDate}
                                    mode="date"
                                    display="default"
                                    onChange={onDateChange}
                                />
                            )}
                            <Button mode="contained" onPress={generateBillPDF} style={{marginTop: 20}}>
                                Generate & Share PDF
                            </Button>
                        </Card.Content>
                    </Card>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles_details = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    card: { margin: 8, elevation: 2 },
    dueText: { marginTop: 10, color: 'red', fontWeight: 'bold' },
    actions: { justifyContent: 'space-between' },
    listItemRight: { alignSelf: 'center', fontSize: 16, fontWeight: 'bold' },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalCard: {
        width: '90%',
        paddingBottom: 10,
    },
});

export default CustomerDetailScreen;