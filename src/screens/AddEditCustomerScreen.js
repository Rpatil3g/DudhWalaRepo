import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { addCustomer, updateCustomer, getCustomerById } from '../db/Database';

const AddEditCustomerScreen = () => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const navigation = useNavigation();
    const route = useRoute();
    const { customerId } = route.params;
    const theme = useTheme();

    useEffect(() => {
        if (customerId) {
            getCustomerById(customerId).then(customer => {
                if (customer) {
                    setName(customer.name);
                    setAddress(customer.address);
                    setPhone(customer.phone);
                }
            });
        }
    }, [customerId]);

    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert("Validation Error", "Customer name is required.");
            return;
        }

        // Validate that if a phone number is entered, it is exactly 10 digits
        if (phone && phone.trim().length > 0 && phone.trim().length !== 10) {
            Alert.alert("Validation Error", "Phone number must be exactly 10 digits.");
            return;
        }

        const promise = customerId
            ? updateCustomer(customerId, name, address, phone)
            : addCustomer(name, address, phone);

        promise
            .then(() => {
                Alert.alert("Success", `Customer ${customerId ? 'updated' : 'added'} successfully.`);
                navigation.goBack();
            })
            .catch(err => {
                Alert.alert("Error", "Could not save customer.");
                console.error(err);
            });
    };

    return (
        <View style={styles_add_edit.container}>
            <TextInput
                label="Name"
                value={name}
                onChangeText={setName}
                style={styles_add_edit.input}
                mode="outlined"
            />
            <TextInput
                label="Address"
                value={address}
                onChangeText={setAddress}
                style={styles_add_edit.input}
                mode="outlined"
                multiline
            />
            <TextInput
                label="Phone Number (10 digits)"
                value={phone}
                onChangeText={setPhone}
                style={styles_add_edit.input}
                mode="outlined"
                keyboardType="phone-pad"
                maxLength={10}
            />
            <Button
                mode="contained"
                onPress={handleSave}
                style={styles_add_edit.button}
                color={theme.colors.primary}
            >
                {customerId ? 'Update Customer' : 'Add Customer'}
            </Button>
        </View>
    );
};

const styles_add_edit = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    input: { marginBottom: 16 },
    button: { marginTop: 16, padding: 8 },
});

export default AddEditCustomerScreen;
