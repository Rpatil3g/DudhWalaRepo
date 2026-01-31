/*
================================================================================
File: src/screens/CustomersScreen.js
Description: List of customers with search, quick sales entry, and history view.
*** UPDATED: Fixed bug where new customers (without sales) were hidden ***
================================================================================
*/
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, FlatList, Alert, Modal, Platform, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Title, IconButton, useTheme, Menu, Divider, TextInput, Searchbar, FAB, Avatar, Surface, Badge } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getSalesDataForDate, recordSale, updateSale, deleteSale, getCustomerProducts, getSaleForCustomerProductAndDate, getLastSevenDaysSalesForCustomer, getSalesForCustomer, getAllCustomers } from '../db/Database';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// Helper component for the status circles (Last 7 Days)
const StatusCircles = ({ salesHistory }) => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.unshift(date); 
    }

    return (
        <View style={styles_customers.statusRow}>
            <Text style={styles_customers.statusLabel}>Last 7 Days:</Text>
            <View style={styles_customers.circlesContainer}>
                {dates.map((date, index) => {
                    const dateString = format(date, 'yyyy-MM-dd');
                    const hasSale = salesHistory.includes(dateString);
                    const isToday = index === 6;
                    
                    return (
                        <View 
                            key={index} 
                            style={[
                                styles_customers.statusCircle, 
                                { 
                                    backgroundColor: hasSale ? '#4CAF50' : '#e0e0e0',
                                    borderColor: isToday ? '#0066cc' : 'transparent',
                                    borderWidth: isToday ? 2 : 0
                                }
                            ]} 
                        />
                    );
                })}
            </View>
        </View>
    );
};

const CustomersScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [salesHistoryMap, setSalesHistoryMap] = useState({});

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerProducts, setCustomerProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [qty, setQty] = useState('');
    const [saleRate, setSaleRate] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [existingSale, setExistingSale] = useState(null);

    // Hide default header to use custom one
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const loadData = useCallback(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        // Parallel Fetch: Get ALL customers AND Today's Sales
        Promise.all([
            getAllCustomers(),           // Returns all active customers + default product name
            getSalesDataForDate(todayStr) // Returns only customers with sales today
        ]).then(([allCusts, todaysSales]) => {
            
            // Create a lookup map for today's sales
            const salesMap = {};
            todaysSales.forEach(s => {
                salesMap[s.customer_id] = s;
            });

            // Merge Data: Customer Info + Today's Sale Status
            const mergedList = allCusts.map(cust => {
                const sale = salesMap[cust.id];
                return {
                    customer_id: cust.id,
                    customer_name: cust.name,
                    // If sale exists, use sale product name. Else use default product name.
                    product_name: sale ? sale.product_name : (cust.default_product_name || 'No Product Assigned'),
                    sale_id: sale ? sale.sale_id : null, 
                };
            });

            setCustomers(mergedList);
            setFilteredCustomers(mergedList); // Initial filter state is full list
            
            // Load history for all customers (can be optimized later if list is huge)
            mergedList.forEach(c => {
                getLastSevenDaysSalesForCustomer(c.customer_id).then(dates => {
                    setSalesHistoryMap(prev => ({ ...prev, [c.customer_id]: dates }));
                });
            });
        });
    }, []);

    useFocusEffect(loadData);

    const onChangeSearch = query => {
        setSearchQuery(query);
        if (query) {
            const filtered = customers.filter(c => 
                c.customer_name.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredCustomers(filtered);
        } else {
            setFilteredCustomers(customers);
        }
    };

    // --- Modal Logic ---
    const openEntryModal = async (customerEntry) => {
        setSelectedCustomer(customerEntry);
        const products = await getCustomerProducts(customerEntry.customer_id);
        setCustomerProducts(products);

        // Auto-select first product or the one from the entry if editing
        let productToSelect = products.length > 0 ? products[0] : null;
        
        setSelectedDate(new Date()); // Reset to today
        
        if (products.length > 0) {
            // This will handle fetching logic for Quantity/Rate
            await handleProductSelect(productToSelect, customerEntry.customer_id);
        }
        
        setModalVisible(true);
    };

    const handleProductSelect = async (product, custId) => {
        setSelectedProduct(product);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        
        // 1. Check for existing sale for THIS date (Edit Mode)
        const sale = await getSaleForCustomerProductAndDate(custId, product.id, dateStr);
        
        if (sale) {
            setExistingSale(sale);
            setQty(String(sale.quantity));
            setSaleRate(String(sale.price_per_unit));
        } else {
            // 2. New Entry: Pre-populate logic
            setExistingSale(null);
            
            // Logic: 
            // Quantity -> From Last Recorded Sale (Historical habit)
            // Rate -> From Current Product Configuration (Updates accordingly if rate changed globally/custom)
            
            const currentEffectiveRate = String(product.custom_price || '');
            
            try {
                // Fetch sales history to find last entry (search last 60 days)
                const today = new Date();
                const pastDate = new Date();
                pastDate.setDate(today.getDate() - 60);
                
                const startStr = format(pastDate, 'yyyy-MM-dd');
                const endStr = format(today, 'yyyy-MM-dd');

                const history = await getSalesForCustomer(custId, startStr, endStr);
                
                // Filter for this product and sort descending (newest first)
                const lastSale = history
                    .filter(s => s.product_id === product.id)
                    .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))[0];

                if (lastSale) {
                    setQty(String(lastSale.quantity));
                } else {
                    setQty(String(product.default_quantity || ''));
                }
            } catch (err) {
                console.log("Error fetching last sale, using defaults", err);
                setQty(String(product.default_quantity || ''));
            }

            // Always use current effective rate
            setSaleRate(currentEffectiveRate);
        }
    };

    const handleSave = () => {
        if (!selectedProduct || !qty || !saleRate) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        const dateString = format(selectedDate, 'yyyy-MM-dd');
        const promise = existingSale
            ? updateSale(existingSale.id, qty, saleRate, dateString)
            : recordSale(selectedCustomer.customer_id, selectedProduct.id, qty, saleRate, dateString);

        promise.then(() => {
            setModalVisible(false);
            loadData();
        });
    };

    const handleDateChange = (event, date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
            // Re-run logic for new date (might need to fetch existing sale or defaults)
            if (selectedCustomer && selectedProduct) {
                const dateStr = format(date, 'yyyy-MM-dd');
                getSaleForCustomerProductAndDate(selectedCustomer.customer_id, selectedProduct.id, dateStr).then(sale => {
                    if (sale) {
                        setExistingSale(sale);
                        setQty(String(sale.quantity));
                        setSaleRate(String(sale.price_per_unit));
                    } else {
                        // If switching to a date with NO sale, we keep the previously set values (which might be last entry defaults)
                        // This allows user to easily select "Yesterday" and have the "Last Entry" values ready to save.
                        setExistingSale(null);
                    }
                });
            }
        }
    };

    const navigateToDetail = (customer) => {
        // We need the ID. customer_id comes from the join query.
        navigation.navigate('Customers', { 
            screen: 'CustomerDetail', 
            params: { customerId: customer.customer_id } 
        });
    };

    const renderItem = ({ item }) => {
        const isRecorded = !!item.sale_id; // If sales_id is present from the query
        const initials = item.customer_name.substring(0, 2).toUpperCase();
        
        return (
            <Card style={styles_customers.card} onPress={() => navigateToDetail(item)}>
                <Card.Content style={styles_customers.cardContent}>
                    <View style={styles_customers.headerRow}>
                        <View style={styles_customers.userInfo}>
                            <Avatar.Text 
                                size={48} 
                                label={initials} 
                                style={{ backgroundColor: theme.colors.primary }} 
                                labelStyle={{ fontSize: 15, fontWeight: 'bold' }} // Reduced size for better padding
                                color="white"
                            />
                            <View style={{ marginLeft: 12 }}>
                                <Title style={styles_customers.name}>{item.customer_name}</Title>
                                <Text style={styles_customers.productLabel}>
                                    {item.product_name}
                                </Text>
                            </View>
                        </View>
                        
                        {/* Action Button */}
                        <View>
                            {isRecorded ? (
                                <Surface style={styles_customers.recordedBadge} elevation={1}>
                                    <Icon name="check" size={14} color="#2e7d32" />
                                    <Text style={styles_customers.recordedText}>Recorded</Text>
                                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); openEntryModal(item); }}>
                                         <Icon name="pencil" size={16} color="#666" style={{marginLeft: 6}}/>
                                    </TouchableOpacity>
                                </Surface>
                            ) : (
                                <Button 
                                    mode="contained" 
                                    compact 
                                    uppercase={false}
                                    onPress={(e) => { e.stopPropagation(); openEntryModal(item); }}
                                    style={styles_customers.addBtn}
                                    labelStyle={{ fontSize: 12 }}
                                >
                                    Add Entry
                                </Button>
                            )}
                        </View>
                    </View>

                    <Divider style={{ marginVertical: 12 }} />

                    {/* Footer: History */}
                    <StatusCircles salesHistory={salesHistoryMap[item.customer_id] || []} />

                </Card.Content>
            </Card>
        );
    };

    return (
        <View style={styles_customers.container}>
            {/* Custom Header with Search */}
            <View style={[styles_customers.headerBg, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles_customers.headerTitle}>My Customers</Text>
                <Searchbar
                    placeholder="Search customers..."
                    onChangeText={onChangeSearch}
                    value={searchQuery}
                    style={styles_customers.searchbar}
                    inputStyle={{ fontSize: 14, paddingVertical: 0, textAlignVertical: 'center' }} // Centered and prevented touching bottom
                    iconColor={theme.colors.primary}
                />
            </View>

            <FlatList
                data={filteredCustomers}
                renderItem={renderItem}
                keyExtractor={item => item.customer_id.toString()}
                contentContainerStyle={styles_customers.list}
                showsVerticalScrollIndicator={false}
            />

            <FAB
                style={[styles_customers.fab, { backgroundColor: theme.colors.accent }]}
                icon="plus"
                color="black"
                onPress={() => navigation.navigate('Customers', { screen: 'AddEditCustomer', params: { customerId: undefined } })}
            />

            {/* Record Sale Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles_customers.modalOverlay}>
                    <Card style={styles_customers.modalCard}>
                        <View style={styles_customers.modalHeader}>
                            <Title style={{ fontSize: 18 }}>Record Sale</Title>
                            <IconButton icon="close" size={20} onPress={() => setModalVisible(false)} />
                        </View>
                        <Divider />
                        <Card.Content style={{ paddingTop: 16 }}>
                            {selectedCustomer && <Text style={{marginBottom: 10, fontWeight: 'bold', color: '#555'}}>Customer: {selectedCustomer.customer_name}</Text>}
                            
                            {/* Product Selector (Simple Tabs or List if multiple) */}
                            <View style={styles_customers.productSelector}>
                                {customerProducts.map(p => (
                                    <TouchableOpacity 
                                        key={p.id} 
                                        onPress={() => handleProductSelect(p, selectedCustomer.customer_id)}
                                        style={[
                                            styles_customers.productChip, 
                                            selectedProduct?.id === p.id && styles_customers.productChipSelected
                                        ]}
                                    >
                                        <Text style={{ color: selectedProduct?.id === p.id ? 'white' : '#333', fontSize: 12 }}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Button mode="outlined" onPress={() => setShowDatePicker(true)} style={styles_customers.dateBtn} icon="calendar">
                                {format(selectedDate, 'dd MMM yyyy')}
                            </Button>

                            <View style={styles_customers.inputRow}>
                                <TextInput
                                    label={`Qty (${selectedProduct?.unit || ''})`}
                                    value={qty}
                                    onChangeText={setQty}
                                    keyboardType="numeric"
                                    style={[styles_customers.input, { flex: 1, marginRight: 8 }]}
                                    mode="outlined"
                                    dense
                                />
                                <TextInput
                                    label="Rate (₹)"
                                    value={saleRate}
                                    onChangeText={setSaleRate}
                                    keyboardType="numeric"
                                    style={[styles_customers.input, { flex: 1 }]}
                                    mode="outlined"
                                    dense
                                />
                            </View>

                            <Button mode="contained" onPress={handleSave} style={{ marginTop: 16 }}>
                                Save Entry
                            </Button>
                        </Card.Content>
                    </Card>
                </View>
            </Modal>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                />
            )}
        </View>
    );
};

const styles_customers = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    
    // Header
    headerBg: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: 10,
        elevation: 4
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 12,
        marginLeft: 4
    },
    searchbar: {
        borderRadius: 12,
        height: 45,
        backgroundColor: 'white',
        elevation: 2,
        justifyContent: 'center' // Ensure content centers vertically
    },

    // List & Card
    list: { paddingHorizontal: 16, paddingBottom: 80 },
    card: {
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: 'white',
        elevation: 2,
    },
    cardContent: { paddingVertical: 12, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    name: { fontSize: 16, fontWeight: 'bold', color: '#333', lineHeight: 20 },
    productLabel: { fontSize: 12, color: '#666' },
    
    // Status Circles
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusLabel: { fontSize: 11, color: '#888', fontStyle: 'italic' },
    circlesContainer: { flexDirection: 'row' },
    statusCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginHorizontal: 3,
    },

    // Badges & Buttons
    addBtn: { borderRadius: 20, backgroundColor: '#0066cc' },
    recordedBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#e8f5e9', 
        paddingVertical: 4, 
        paddingHorizontal: 10, 
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#c8e6c9'
    },
    recordedText: { fontSize: 12, color: '#2e7d32', fontWeight: '600', marginLeft: 4 },

    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalCard: { width: '85%', borderRadius: 12, backgroundColor: 'white', paddingBottom: 8 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
    productSelector: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    productChip: { 
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee', marginRight: 8, marginBottom: 8 
    },
    productChipSelected: { backgroundColor: '#0066cc' },
    dateBtn: { marginBottom: 12, borderColor: '#ccc' },
    inputRow: { flexDirection: 'row' },
    input: { backgroundColor: 'white' }
});

export default CustomersScreen;