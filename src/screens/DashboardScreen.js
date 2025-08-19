
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Title, List, Divider, Button } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { getTotalSalesForPeriod, getCustomerDues, getAllDataForBackup } from '../db/Database';
import { format, startOfMonth } from 'date-fns';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const DashboardScreen = () => {
    const [todaySales, setTodaySales] = useState(0);
    const [monthSales, setMonthSales] = useState(0);
    const [customerDues, setCustomerDues] = useState([]);

    const loadReports = useCallback(() => {
        const today = new Date();
        const todayString = format(today, 'yyyy-MM-dd');
        const startOfMonthString = format(startOfMonth(today), 'yyyy-MM-dd');
        
        getTotalSalesForPeriod(todayString, todayString)
            .then(setTodaySales)
            .catch(err => console.error("Error getting today's sales:", err));

        getTotalSalesForPeriod(startOfMonthString, todayString)
            .then(setMonthSales)
            .catch(err => console.error("Error getting this month's sales:", err));

        getCustomerDues()
            .then(dues => setCustomerDues(dues.filter(d => d.total_due > 0)))
            .catch(err => console.error("Error getting customer dues:", err));
    }, []);

    useFocusEffect(loadReports);

    const handleBackup = async () => {
        try {
            const data = await getAllDataForBackup();
            const backupDataString = JSON.stringify(data, null, 2);
            
            const date = new Date();
            const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
            const filename = `milkwala_backup_${timestamp}.json`;
            const uri = FileSystem.documentDirectory + filename;

            await FileSystem.writeAsStringAsync(uri, backupDataString, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert("Sharing not available", "Sharing is not available on your device.");
                return;
            }

            await Sharing.shareAsync(uri, {
                mimeType: 'application/json',
                dialogTitle: 'Save your backup file',
            });

        } catch (error) {
            Alert.alert("Backup Failed", "An error occurred while creating the backup file.");
            console.error("Backup error:", error);
        }
    };

    return (
        <ScrollView style={styles_dashboard.container}>
             <Card style={styles_dashboard.card}>
                <Card.Content>
                    <Title>Today's Sales</Title>
                    <Text style={styles_dashboard.salesText}>₹{todaySales ? todaySales.toFixed(2) : '0.00'}</Text>
                </Card.Content>
            </Card>

            <Card style={styles_dashboard.card}>
                <Card.Content>
                    <Title>This Month's Sales</Title>
                    <Text style={styles_dashboard.salesText}>₹{monthSales ? monthSales.toFixed(2) : '0.00'}</Text>
                </Card.Content>
            </Card>

            <Card style={styles_dashboard.card}>
                <Card.Content>
                    <Title>Backup & Restore</Title>
                    <Text style={{marginVertical: 10}}>
                        Create a backup of all customers, products, and this month's sales. Save the file to a safe place like Google Drive.
                    </Text>
                    <Button icon="database-export" mode="contained" onPress={handleBackup}>
                        Backup This Month's Data
                    </Button>
                </Card.Content>
            </Card>

            <Card style={styles_dashboard.card}>
                <Card.Content>
                    <Title>Customers with Outstanding Dues</Title>
                    <List.Section>
                        {customerDues.length > 0 ? customerDues.map(due => (
                            <View key={due.id}>
                                <List.Item
                                    title={due.name}
                                    right={() => <Text style={styles_dashboard.dueAmount}>₹{due.total_due.toFixed(2)}</Text>}
                                />
                                <Divider />
                            </View>
                        )) : <Text>No outstanding dues.</Text>}
                    </List.Section>
                </Card.Content>
            </Card>
        </ScrollView>
    );
};

const styles_dashboard = StyleSheet.create({
    container: { flex: 1, padding: 8, backgroundColor: '#f5f5f5' },
    card: { margin: 8, elevation: 2 },
    salesText: { fontSize: 32, fontWeight: 'bold', color: '#0066cc', marginVertical: 10, textAlign: 'center' },
    dueAmount: { alignSelf: 'center', fontSize: 16, color: 'red', fontWeight: 'bold' }
});

export default DashboardScreen;
