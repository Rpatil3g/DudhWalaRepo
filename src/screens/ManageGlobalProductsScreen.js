import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, Modal } from 'react-native';
import { Text, Button, Card, Title, TextInput, List, IconButton, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getAllProducts, updateProduct, updateAllCustomPricesForProduct } from '../db/Database';

const ManageGlobalProductsScreen = () => {
    const [products, setProducts] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [price, setPrice] = useState('');

    const loadProducts = useCallback(() => {
        getAllProducts().then(setProducts).catch(console.error);
    }, []);

    useFocusEffect(loadProducts);

    const openEditModal = (product) => {
        setSelectedProduct(product);
        setName(product.name);
        setUnit(product.unit);
        setPrice(String(product.default_price));
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedProduct(null);
    };

    const handleUpdate = () => {
        if (!name.trim() || !unit.trim() || !price.trim()) {
            Alert.alert("Validation Error", "All fields are required.");
            return;
        }
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            Alert.alert("Validation Error", "Please enter a valid price.");
            return;
        }

        updateProduct(selectedProduct.id, name, unit, parsedPrice)
            .then(() => {
                // After successfully updating the default price, ask the user if they want to update customer prices
                Alert.alert(
                    "Update Custom Prices?",
                    `Do you want to apply this new default price (₹${parsedPrice.toFixed(2)}) to all customers who are assigned this product?`,
                    [
                        {
                            text: "Yes, Update All",
                            onPress: () => {
                                updateAllCustomPricesForProduct(selectedProduct.id, parsedPrice)
                                    .then(() => {
                                        Alert.alert("Success", "Product and all customer prices updated successfully.");
                                        closeModal();
                                        loadProducts();
                                    })
                                    .catch(err => {
                                        Alert.alert("Error", "Could not update customer prices.");
                                        console.error(err);
                                    });
                            }
                        },
                        {
                            text: "No, Keep Custom Prices",
                            style: "cancel",
                            onPress: () => {
                                Alert.alert("Success", "Product default price updated successfully. Custom prices were not changed.");
                                closeModal();
                                loadProducts();
                            }
                        }
                    ]
                );
            })
            .catch(err => {
                Alert.alert("Error", "Failed to update product.");
                console.error(err);
            });
    };

    const renderItem = ({ item }) => (
        <>
            <List.Item
                title={item.name}
                description={`Unit: ${item.unit} | Default Price: ₹${item.default_price.toFixed(2)}`}
                onPress={() => openEditModal(item)}
                right={(props) => <List.Icon {...props} icon="pencil" />}
            />
            <Divider />
        </>
    );

    return (
        <View style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Manage All Products</Title>
                    <Text>Tap a product to edit its default name, unit, or price. New sales entries will use this new default price unless a custom price is set for a customer.</Text>
                </Card.Content>
            </Card>
            <FlatList
                data={products}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                ListEmptyComponent={<Text style={styles.emptyText}>No products found. Add products via the "Manage Products" screen for any customer.</Text>}
            />
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.modalContainer}>
                    <Card style={styles.modalCard}>
                        <Card.Title
                            title="Edit Product"
                            subtitle={selectedProduct?.name}
                            right={(props) => <IconButton {...props} icon="close" onPress={closeModal} />}
                        />
                        <Card.Content>
                            <TextInput
                                label="Product Name"
                                value={name}
                                onChangeText={setName}
                                style={styles.input}
                                mode="outlined"
                            />
                            <TextInput
                                label="Unit (e.g., Liter, Packet)"
                                value={unit}
                                onChangeText={setUnit}
                                style={styles.input}
                                mode="outlined"
                            />
                            <TextInput
                                label="Default Price (₹)"
                                value={price}
                                onChangeText={setPrice}
                                style={styles.input}
                                keyboardType="numeric"
                                mode="outlined"
                            />
                            <Button mode="contained" onPress={handleUpdate} style={{ marginTop: 10 }}>
                                Update Product
                            </Button>
                        </Card.Content>
                    </Card>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: { margin: 8 },
    emptyText: { textAlign: 'center', marginTop: 50, paddingHorizontal: 20 },
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
    input: {
        marginTop: 15
    }
});

export default ManageGlobalProductsScreen;
