import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, Modal, Platform } from 'react-native';
import { Text, Button, Card, Title, Paragraph, IconButton, useTheme, Menu, Divider, TextInput, Searchbar, FAB, Avatar } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getSalesDataForDate, recordSale, updateSale, deleteSale, getCustomerProducts, getSaleForCustomerProductAndDate, getLastSevenDaysSalesForCustomer } from '../db/Database';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

// Helper component for the status circles
const StatusCircles = ({ salesHistory }) => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.unshift(date); // Add to the beginning to have today on the right
    }

    return (
        <View style={styles_customers.statusContainer}>
            {dates.map((date, index) => {
                const dateString = format(date, 'yyyy-MM-dd');
                const hasSale = salesHistory.includes(dateString);
                return (
                    <View key={index} style={[styles_customers.statusCircle, { backgroundColor: hasSale ? '#4CAF50' : '#cccccc' }]} />
                );
            })}
        </View>
    );
};

// Helper to abbreviate units
const abbreviateUnit = (unit) => {
    if (!unit) return '';
    const lowerUnit = unit.toLowerCase();
    if (lowerUnit.startsWith('liter')) return 'L';
    if (lowerUnit.startsWith('packet')) return 'Pkt';
    if (lowerUnit.startsWith('kg')) return 'Kg';
    return unit;
};

const CustomersScreen = () => {
    const [allEntries, setAllEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const theme = useTheme();
    const navigation = useNavigation();

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [currentSale, setCurrentSale] = useState(null);
    const [customerProducts, setCustomerProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [rate, setRate] = useState('');
    const [productMenuVisible, setProductMenuVisible] = useState(false);
    const [saleDate, setSaleDate] = useState(new Date());
    const [showSaleDatePicker, setShowSaleDatePicker] = useState(false);

    const loadData = useCallback(() => {
        setLoading(true);
        const dateString = format(new Date(), 'yyyy-MM-dd');
        
        getSalesDataForDate(dateString).then(async (data) => {
            const customerMap = data.reduce((acc, item) => {
                if (!acc[item.customer_id]) {
                    acc[item.customer_id] = {
                        customer_id: item.customer_id,
                        customer_name: item.customer_name,
                        products: [],
                        salesHistory: [], // Initialize sales history
                    };
                }
                if (item.product_id) {
                    acc[item.customer_id].products.push(item);
                }
                return acc;
            }, {});
            
            let groupedData = Object.values(customerMap);

            // Fetch 7-day sales history for each customer
            const historyPromises = groupedData.map(customer => 
                getLastSevenDaysSalesForCustomer(customer.customer_id)
            );
            const histories = await Promise.all(historyPromises);
            
            // Add history to each customer object
            groupedData = groupedData.map((customer, index) => ({
                ...customer,
                salesHistory: histories[index],
            }));

            setAllEntries(groupedData);
            setFilteredEntries(groupedData);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    useFocusEffect(loadData);
    
    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query) {
            const filtered = allEntries.filter(entry =>
                entry.customer_name.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredEntries(filtered);
        } else {
            setFilteredEntries(allEntries);
        }
    };

    const openModal = async (customer, product) => {
        const products = await getCustomerProducts(customer.customer_id);
        const currentProduct = products.find(p => p.id === product.product_id);
        
        setCustomerProducts(products);
        setSelectedEntry(product);
        setSelectedProduct(currentProduct);
        setCurrentSale(product.sale_id ? product : null);

        if (product.sale_id) {
            setQuantity(String(product.sale_quantity));
            setRate(String(product.sale_price));
            setSaleDate(new Date());
        } else {
            setQuantity(String(product.default_quantity));
            setRate(String(currentProduct?.custom_price || ''));
            setSaleDate(new Date());
        }
        setModalVisible(true);
    };

    const handleSaveSale = () => {
        if (!selectedEntry || !selectedProduct || !quantity || !rate) {
            Alert.alert("Error", "Please fill all fields.");
            return;
        }
        const qty = parseFloat(quantity);
        const saleRate = parseFloat(rate);
        if (isNaN(qty) || qty < 0 || isNaN(saleRate) || saleRate < 0) {
            Alert.alert("Error", "Please enter a valid quantity and rate.");
            return;
        }

        const dateString = format(saleDate, 'yyyy-MM-dd');
        const promise = currentSale?.id
            ? updateSale(currentSale.id, qty, saleRate, dateString)
            : recordSale(selectedEntry.customer_id, selectedProduct.id, qty, saleRate, dateString);

        promise.then(() => {
            Alert.alert("Success", "Sale recorded successfully.");
            closeModal();
            loadData();
        }).catch(err => {
            Alert.alert("Error", "Failed to save sale.");
            console.error(err);
        });
    };
    
    const handleDeleteSale = () => {
        if (!currentSale?.id) return;
        
        Alert.alert("Confirm Delete", "Are you sure you want to delete this sale entry?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive",
                    onPress: () => {
                        deleteSale(currentSale.id).then(() => {
                            Alert.alert("Success", "Sale entry deleted.");
                            closeModal();
                            loadData();
                        }).catch(err => {
                            Alert.alert("Error", "Failed to delete sale.");
                            console.error(err);
                        });
                    }
                }
            ]
        );
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedEntry(null);
        setCurrentSale(null);
        setCustomerProducts([]);
        setSelectedProduct(null);
        setQuantity('');
        setRate('');
    };

    const onSaleDateChange = async (event, selectedDate) => {
        const newDate = selectedDate || saleDate;
        setShowSaleDatePicker(Platform.OS === 'ios');
        setSaleDate(newDate);

        if (Platform.OS !== 'ios') {
            setShowSaleDatePicker(false);
        }

        const dateString = format(newDate, 'yyyy-MM-dd');
        const existingSale = await getSaleForCustomerProductAndDate(selectedEntry.customer_id, selectedProduct.id, dateString);
        
        setCurrentSale(existingSale);
        if (existingSale) {
            setQuantity(String(existingSale.quantity));
            setRate(String(existingSale.price_per_unit));
        } else {
            setQuantity(String(selectedProduct.default_quantity));
            setRate(String(selectedProduct.custom_price));
        }
    };

    const renderItem = ({ item }) => (
        <Card style={styles_customers.card}>
            <Card.Title
                title={item.customer_name}
                subtitle={<StatusCircles salesHistory={item.salesHistory} />}
                left={(props) => <Avatar.Text {...props} label={item.customer_name.charAt(0).toUpperCase()} />}
                right={(props) => <IconButton {...props} icon="dots-vertical" onPress={() => navigation.navigate('CustomerDetail', { customerId: item.customer_id })} />}
            />
            <Card.Content>
                {item.products.length > 0 ? (
                    item.products.map(product => (
                        <View key={product.product_id} style={styles_customers.entryContainer}>
                            <Text style={styles_customers.productText}>{product.product_name}</Text>
                            {product.sale_id ? (
                                <View style={styles_customers.recordedContainer}>
                                    <Text style={styles_customers.entryText}>
                                        {product.sale_quantity} {abbreviateUnit(product.unit)}
                                    </Text>
                                    <Button compact mode="outlined" onPress={() => openModal(item, product)}>Edit</Button>
                                </View>
                            ) : (
                                 <Button compact mode="contained" onPress={() => openModal(item, product)}>Add Entry</Button>
                            )}
                        </View>
                    ))
                ) : (
                    <View style={styles_customers.noProductsContainer}>
                        <Text style={styles_customers.entryText}>No products assigned.</Text>
                        <Button onPress={() => navigation.navigate('ManageProducts', { customerId: item.customer_id })}>
                            Assign Products
                        </Button>
                    </View>
                )}
            </Card.Content>
        </Card>
    );

    return (
        <View style={styles_customers.container}>
            <Searchbar
                placeholder="Search Customers..."
                onChangeText={handleSearch}
                value={searchQuery}
                style={styles_customers.searchbar}
            />
            
            {loading ? <Text style={{textAlign: 'center', marginTop: 20}}>Loading...</Text> : (
                <FlatList
                    data={filteredEntries}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.customer_id.toString()}
                    contentContainerStyle={styles_customers.list}
                    ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 50}}>No customers found. Add one to get started!</Text>}
                />
            )}
            
            <FAB
                style={styles_customers.fab}
                icon="account-plus"
                label="New Customer"
                onPress={() => navigation.navigate('AddEditCustomer', {})}
            />
            
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles_customers.modalContainer}>
                    <Card style={styles_customers.modalCard}>
                        <Card.Title
                            title={currentSale?.id ? "Edit Sale" : "Add Sale"}
                            subtitle={`${selectedEntry?.customer_name}`}
                            right={(props) => <IconButton {...props} icon="close" onPress={closeModal} />}
                        />
                        <Card.Content>
                            <Button icon="calendar" mode="outlined" onPress={() => setShowSaleDatePicker(true)} style={{marginBottom: 15}}>
                                Sale Date: {format(saleDate, 'dd MMM yyyy')}
                            </Button>

                            {showSaleDatePicker && (
                                <DateTimePicker
                                    testID="saleDatePicker"
                                    value={saleDate}
                                    mode="date"
                                    display="default"
                                    onChange={onSaleDateChange}
                                />
                            )}

                            <Menu
                                visible={productMenuVisible}
                                onDismiss={() => setProductMenuVisible(false)}
                                anchor={
                                    <Button mode="outlined" onPress={() => setProductMenuVisible(true)} disabled={true}>
                                        {selectedProduct ? selectedProduct.name : "Select Product"}
                                    </Button>
                                }
                            >
                                {customerProducts.map(p => (
                                    <Menu.Item
                                        key={p.id}
                                        onPress={() => {
                                            setSelectedProduct(p);
                                            setRate(String(p.custom_price));
                                            setProductMenuVisible(false);
                                        }}
                                        title={p.name}
                                    />
                                ))}
                            </Menu>
                            
                            <TextInput
                                label={`Rate (₹)`}
                                value={rate}
                                onChangeText={setRate}
                                style={styles_customers.modalInput}
                                keyboardType="numeric"
                                mode="outlined"
                            />

                            <TextInput
                                label={`Quantity (${selectedProduct ? abbreviateUnit(selectedProduct.unit) : ''})`}
                                value={quantity}
                                onChangeText={setQuantity}
                                style={styles_customers.modalInput}
                                keyboardType="numeric"
                                mode="outlined"
                            />

                            <Button mode="contained" onPress={handleSaveSale} style={{marginTop: 10}}>
                                Save
                            </Button>
                            {currentSale?.id && (
                                <Button mode="text" color={theme.colors.error} onPress={handleDeleteSale} style={{marginTop: 10}}>
                                    Delete Entry
                                </Button>
                            )}
                        </Card.Content>
                    </Card>
                </View>
            </Modal>
        </View>
    );
};

const styles_customers = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    searchbar: {
        margin: 8,
    },
    list: { paddingHorizontal: 8, paddingBottom: 80 },
    card: { marginVertical: 4, elevation: 2 },
    statusContainer: {
        flexDirection: 'row',
        marginTop: 4,
    },
    statusCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginHorizontal: 2,
    },
    entryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee'
    },
    noProductsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    productText: {
        fontSize: 16,
        flex: 1,
    },
    recordedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    entryText: {
        fontSize: 16,
        color: '#666',
        marginRight: 8,
    },
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
    modalInput: {
        marginTop: 15
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    }
});

export default CustomersScreen;