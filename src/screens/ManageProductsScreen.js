import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, Title, TextInput, Checkbox, List, Divider } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getAllProducts, getCustomerProducts, assignProductToCustomer, addProduct } from '../db/Database';

const ManageProductsScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { customerId } = route.params;

    const [allProducts, setAllProducts] = useState([]);
    const [customerProducts, setCustomerProducts] = useState({});

    // State for the new product form
    const [newProductName, setNewProductName] = useState('');
    const [newProductUnit, setNewProductUnit] = useState('Liter');
    const [newProductPrice, setNewProductPrice] = useState('');

    const loadData = useCallback(() => {
        getAllProducts().then(setAllProducts);
        getCustomerProducts(customerId).then(assigned => {
            const assignedMap = assigned.reduce((acc, p) => {
                acc[p.id] = {
                    custom_price: p.custom_price,
                    default_quantity: p.default_quantity,
                };
                return acc;
            }, {});
            setCustomerProducts(assignedMap);
        });
    }, [customerId]);
    
    useEffect(loadData, [loadData]);

    const handleToggleProduct = (productId) => {
        const newCustomerProducts = { ...customerProducts };
        if (newCustomerProducts[productId]) {
            delete newCustomerProducts[productId];
        } else {
            const product = allProducts.find(p => p.id === productId);
            newCustomerProducts[productId] = {
                custom_price: product.default_price,
                default_quantity: 1.0,
            };
        }
        setCustomerProducts(newCustomerProducts);
    };

    const handleValueChange = (productId, field, value) => {
        const newCustomerProducts = { ...customerProducts };
        if (newCustomerProducts[productId]) {
            newCustomerProducts[productId][field] = parseFloat(value) || 0;
            setCustomerProducts(newCustomerProducts);
        }
    };

    const handleAddNewProduct = () => {
        if (!newProductName.trim() || !newProductUnit.trim() || !newProductPrice.trim()) {
            Alert.alert('Validation Error', 'Please fill all fields for the new product.');
            return;
        }
        const price = parseFloat(newProductPrice);
        if (isNaN(price) || price <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid default price.');
            return;
        }

        addProduct(newProductName, newProductUnit, price)
            .then(() => {
                Alert.alert('Success', `Product "${newProductName}" has been added.`);
                setNewProductName('');
                setNewProductUnit('Liter');
                setNewProductPrice('');
                loadData(); // Refresh the list of products
            })
            .catch(err => {
                Alert.alert('Error', 'Could not add the new product.');
                console.error(err);
            });
    };

    const handleSaveAssignments = () => {
        const promises = Object.entries(customerProducts).map(([productId, values]) => 
            assignProductToCustomer(
                customerId, 
                parseInt(productId), 
                values.custom_price, 
                values.default_quantity
            )
        );

        Promise.all(promises)
            .then(() => {
                Alert.alert("Success", "Product assignments have been saved for the customer.");
                navigation.goBack();
            })
            .catch(err => {
                Alert.alert("Error", "Could not save product assignments.");
                console.error(err);
            });
    };

    return (
        <ScrollView style={styles_manage_products.container}>
            <Card style={styles_manage_products.card}>
                <Card.Content>
                    <Title>Add New Product to System</Title>
                    <TextInput
                        label="Product Name (e.g., Cow Milk)"
                        value={newProductName}
                        onChangeText={setNewProductName}
                        style={styles_manage_products.input}
                        mode="outlined"
                    />
                    <TextInput
                        label="Unit (e.g., Liter, Packet, Kg)"
                        value={newProductUnit}
                        onChangeText={setNewProductUnit}
                        style={styles_manage_products.input}
                        mode="outlined"
                    />
                    <TextInput
                        label="Default Price (₹)"
                        value={newProductPrice}
                        onChangeText={setNewProductPrice}
                        keyboardType="numeric"
                        style={styles_manage_products.input}
                        mode="outlined"
                    />
                    <Button mode="contained" onPress={handleAddNewProduct} style={{ marginTop: 8 }}>
                        Add New Product
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles_manage_products.card}>
                <Card.Content>
                    <Title>Assign Products to Customer</Title>
                    <Divider style={{ marginVertical: 10 }}/>
                    {allProducts.map(product => (
                        <View key={product.id}>
                            <List.Item
                                title={product.name}
                                description={`Default Price: ₹${product.default_price.toFixed(2)}`}
                                left={() => <Checkbox status={customerProducts[product.id] ? 'checked' : 'unchecked'} onPress={() => handleToggleProduct(product.id)} />}
                            />
                            {customerProducts[product.id] && (
                                <View style={styles_manage_products.inputContainer}>
                                    <TextInput
                                        label="Custom Price"
                                        value={String(customerProducts[product.id].custom_price)}
                                        onChangeText={text => handleValueChange(product.id, 'custom_price', text)}
                                        keyboardType="numeric"
                                        style={styles_manage_products.input}
                                        mode="outlined"
                                    />
                                    <TextInput
                                        label={`Default Qty (${product.unit})`}
                                        value={String(customerProducts[product.id].default_quantity)}
                                        onChangeText={text => handleValueChange(product.id, 'default_quantity', text)}
                                        keyboardType="numeric"
                                        style={styles_manage_products.input}
                                        mode="outlined"
                                    />
                                </View>
                            )}
                        </View>
                    ))}
                </Card.Content>
            </Card>
            <Button mode="contained" onPress={handleSaveAssignments} style={styles_manage_products.saveButton}>
                Save Customer Assignments
            </Button>
        </ScrollView>
    );
};

const styles_manage_products = StyleSheet.create({
    container: { flex: 1, padding: 8, backgroundColor: '#f5f5f5' },
    card: { margin: 8, elevation: 2 },
    inputContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingBottom: 16 },
    input: { flex: 1, marginHorizontal: 4, marginBottom: 8 },
    saveButton: { margin: 16, padding: 8 }
});

export default ManageProductsScreen;
