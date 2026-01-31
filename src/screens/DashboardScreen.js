/*
================================================================================
File: src/screens/DashboardScreen.js
Description: Main Dashboard.
*** UPDATED: Optimized Parallel Data Loading for Performance ***
================================================================================
*/
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { Text, Card, Title, List, Divider, Button, Surface, IconButton, Avatar, useTheme, ProgressBar } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getTotalSalesForPeriod, getCustomerDues, getAllDataForBackup, getTotalExpensesForPeriod } from '../db/Database';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ActionButton = ({ icon, label, onPress, color }) => (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
        <Surface style={[styles.actionIconContainer, { backgroundColor: color + '15' }]} elevation={0}>
            <Icon name={icon} size={30} color={color} />
        </Surface>
        <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
);

const formatCurrency = (amount) => {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const DashboardScreen = () => {
    const navigation = useNavigation();
    const theme = useTheme();
    
    // Original State
    const [todaySales, setTodaySales] = useState(0);
    const [monthSales, setMonthSales] = useState(0);
    const [monthExpenses, setMonthExpenses] = useState(0);
    const [customerDues, setCustomerDues] = useState([]);
    
    // New State for Previous Months
    const [lastStats, setLastStats] = useState({ sales: 0, expenses: 0, profit: 0, label: '' });
    const [last2Stats, setLast2Stats] = useState({ sales: 0, expenses: 0, profit: 0, label: '' });
    
    const [refreshing, setRefreshing] = useState(false);

    // Completely remove the default "Dashboard" header to save space
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    const loadReports = useCallback(async () => {
        setRefreshing(true); // Show spinner immediately
        const today = new Date();
        const todayString = format(today, 'yyyy-MM-dd');
        const startOfMonthString = format(startOfMonth(today), 'yyyy-MM-dd');
        
        try {
            // Helper function for previous month stats (moved outside to be cleaner)
            const fetchPreviousMonthStats = async (offset) => {
                const targetDate = subMonths(today, offset);
                const startStr = format(startOfMonth(targetDate), 'yyyy-MM-dd');
                const endStr = format(endOfMonth(targetDate), 'yyyy-MM-dd');
                
                // Parallel fetch for sales and expenses of that specific month
                const [sales, expenses] = await Promise.all([
                    getTotalSalesForPeriod(startStr, endStr),
                    getTotalExpensesForPeriod(startStr, endStr)
                ]);
                
                return {
                    sales: sales || 0,
                    expenses: expenses || 0,
                    profit: (sales || 0) - (expenses || 0),
                    label: format(targetDate, 'MMMM yyyy')
                };
            };

            // --- PARALLEL EXECUTION BLOCK ---
            // We initiate ALL queries at the same time. The total wait time is just the longest single query.
            const [
                tSales,         // 1. Today's Sales
                mSales,         // 2. This Month Sales
                mExpenses,      // 3. This Month Expenses
                allDues,        // 4. All Customer Dues
                lastMonthData,  // 5. Last Month Stats
                last2MonthData  // 6. Month Before Last Stats
            ] = await Promise.all([
                getTotalSalesForPeriod(todayString, todayString),
                getTotalSalesForPeriod(startOfMonthString, todayString),
                getTotalExpensesForPeriod(startOfMonthString, todayString),
                getCustomerDues(),
                fetchPreviousMonthStats(1),
                fetchPreviousMonthStats(2)
            ]);

            // Update all states at once
            setTodaySales(tSales);
            setMonthSales(mSales);
            setMonthExpenses(mExpenses);
            setCustomerDues(allDues.filter(d => d.total_due > 0));
            setLastStats(lastMonthData);
            setLast2Stats(last2MonthData);

        } catch (err) {
            console.error("Error loading dashboard data:", err);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const onRefresh = useCallback(async () => {
        await loadReports();
    }, [loadReports]);

    useFocusEffect(
        useCallback(() => {
            loadReports();
        }, [loadReports])
    );

    const handleBackup = async () => {
        try {
            const data = await getAllDataForBackup();
            const fileUri = FileSystem.documentDirectory + `milkwala_backup_${data.backupDate}.json`;
            await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data), { encoding: FileSystem.EncodingType.UTF8 });
            
            if (!(await Sharing.isAvailableAsync())) {
                Alert.alert("Error", "Sharing is not available on this device");
                return;
            }
            await Sharing.shareAsync(fileUri);
        } catch (error) {
            Alert.alert("Error", "Failed to create backup");
            console.error(error);
        }
    };

    // Helper for History Cards
    const renderHistoryCard = (stats) => {
        const isProfit = stats.profit >= 0;
        return (
            <Surface style={styles.historyCard} elevation={1}>
                <View style={styles.historyRow}>
                    <View style={styles.historyDateCol}>
                        <Text style={styles.historyLabel}>{stats.label}</Text>
                        <View style={styles.miniStatRow}>
                            <Icon name="arrow-up-circle" size={14} color="#2e7d32" />
                            <Text style={styles.miniStatText}> {formatCurrency(stats.sales)}</Text>
                            <Text style={{width: 10}} />
                            <Icon name="arrow-down-circle" size={14} color="#d32f2f" />
                            <Text style={styles.miniStatText}> {formatCurrency(stats.expenses)}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.historyProfitCol}>
                        <Text style={styles.historyProfitLabel}>Net Profit</Text>
                        <Text style={[styles.historyProfitValue, { color: isProfit ? '#2e7d32' : '#d32f2f' }]}>
                            {formatCurrency(stats.profit)}
                        </Text>
                    </View>
                </View>
            </Surface>
        );
    };

    const profit = monthSales - monthExpenses;
    const isProfit = profit >= 0;
    const profitColor = isProfit ? '#2e7d32' : '#c62828'; 
    const profitBg = isProfit ? '#e8f5e9' : '#ffebee';
    
    // Calculate simple health ratio for visual bar
    const totalVolume = monthSales + monthExpenses;
    const salesRatio = totalVolume > 0 ? monthSales / totalVolume : 0.5;

    return (
        <View style={styles.container}>
            {/* Custom Header Background - Compact Version */}
            <View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.headerTitle}>Milkwala Vendor</Text>
                        <Text style={styles.headerDate}>{format(new Date(), 'EEEE, dd MMMM')}</Text>
                    </View>
                    <IconButton icon="cog" iconColor="white" onPress={() => navigation.navigate('ManageGlobalProducts')} />
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
                }
            >
                
                {/* Hero Card - Today's Sales */}
                <Surface style={styles.heroCard} elevation={4}>
                    <View style={styles.heroRow}>
                        <View>
                            <Text style={styles.heroLabel}>Today's Collection</Text>
                            <Text style={styles.heroValue}>{formatCurrency(todaySales)}</Text>
                        </View>
                        <Avatar.Icon size={56} icon="cash-multiple" style={{ backgroundColor: theme.colors.primary }} />
                    </View>
                </Surface>

                {/* Quick Actions */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionRow}>
                        <ActionButton 
                            icon="account-plus" 
                            label="New Customer" 
                            color="#0066cc" 
                            onPress={() => navigation.navigate('Customers', { screen: 'AddEditCustomer', params: { customerId: undefined } })} 
                        />
                        <ActionButton 
                            icon="water-plus" 
                            label="Record Sale" 
                            color="#2e7d32" 
                            onPress={() => navigation.navigate('Customers')} 
                        />
                        <ActionButton 
                            icon="cash-minus" 
                            label="Add Expense" 
                            color="#d32f2f" 
                            onPress={() => navigation.navigate('Expenses')} 
                        />
                        <ActionButton 
                            icon="database-export" 
                            label="Backup Data" 
                            color="#f57c00" 
                            onPress={handleBackup} 
                        />
                    </View>
                </View>

                {/* Month Overview Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>This Month's Health</Text>
                    <Surface style={styles.monthCard} elevation={2}>
                        <View style={styles.gridRow}>
                            <View style={styles.statCol}>
                                <Text style={styles.statLabel}>Income</Text>
                                <Text style={[styles.statValue, { color: '#0066cc' }]}>{formatCurrency(monthSales)}</Text>
                            </View>
                            <View style={[styles.verticalDivider, { backgroundColor: '#eee' }]} />
                            <View style={styles.statCol}>
                                <Text style={styles.statLabel}>Expenses</Text>
                                <Text style={[styles.statValue, { color: '#d32f2f' }]}>{formatCurrency(monthExpenses)}</Text>
                            </View>
                        </View>
                        
                        {/* Visual Ratio Bar */}
                        <View style={styles.ratioBarContainer}>
                            <View style={[styles.ratioBarPart, { backgroundColor: '#0066cc', flex: salesRatio }]} />
                            <View style={[styles.ratioBarPart, { backgroundColor: '#d32f2f', flex: 1 - salesRatio }]} />
                        </View>
                        <View style={styles.ratioLabels}>
                            <Text style={{ fontSize: 10, color: '#0066cc' }}>{(salesRatio * 100).toFixed(0)}% Income</Text>
                            <Text style={{ fontSize: 10, color: '#d32f2f' }}>{((1 - salesRatio) * 100).toFixed(0)}% Exp</Text>
                        </View>

                        <Divider style={{ marginVertical: 12 }} />

                        {/* Net Profit Row */}
                        <View style={styles.profitRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Surface style={[styles.iconSurface, { backgroundColor: profitBg }]}>
                                    <Icon name={isProfit ? "trending-up" : "trending-down"} size={20} color={profitColor} />
                                </Surface>
                                <Text style={styles.profitLabel}>Net Profit</Text>
                            </View>
                            <Text style={[styles.profitValue, { color: profitColor }]}>{formatCurrency(profit)}</Text>
                        </View>
                    </Surface>
                </View>

                {/* Previous Months Section (New Addition) */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Previous Months</Text>
                    {renderHistoryCard(lastStats)}
                    {renderHistoryCard(last2Stats)}
                </View>

                {/* Dues List */}
                <View style={styles.sectionContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.sectionTitle}>Outstanding Dues</Text>
                        <Button mode="text" compact onPress={() => navigation.navigate('Reports')}>View All</Button>
                    </View>
                    
                    <Card style={styles.duesCard}>
                        {customerDues.length > 0 ? (
                            customerDues.slice(0, 5).map((due, index) => (
                                <View key={due.id}>
                                    <List.Item
                                        title={due.name}
                                        titleStyle={{ fontWeight: '500', fontSize: 15 }}
                                        description="Pending Amount"
                                        descriptionStyle={{ fontSize: 12, color: '#888' }}
                                        left={props => (
                                            <Avatar.Text 
                                                size={40} 
                                                label={due.name.substring(0, 2).toUpperCase()} 
                                                style={{ backgroundColor: '#fff3e0', alignSelf: 'center', marginLeft: 10 }}
                                                color="#f57c00"
                                            />
                                        )}
                                        right={() => <Text style={styles.dueAmount}>{formatCurrency(due.total_due)}</Text>}
                                    />
                                    {index < Math.min(customerDues.length, 5) - 1 && <Divider />}
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyDuesContainer}>
                                <Icon name="check-decagram" size={48} color="#4caf50" />
                                <Text style={styles.emptyDuesText}>Excellent! No pending dues.</Text>
                            </View>
                        )}
                    </Card>
                </View>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    headerBg: {
        paddingTop: 45, // Kept ample for status bar
        paddingBottom: 25, // Reduced bottom padding significantly
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 },
    headerDate: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 4, fontWeight: '500' },
    scrollContent: { paddingBottom: 30 },
    
    // Hero Card
    heroCard: {
        marginHorizontal: 16,
        marginTop: -20, // Adjusted negative margin to overlap the shorter header correctly
        paddingTop: 28, 
        paddingBottom: 24,
        paddingHorizontal: 24,
        borderRadius: 20,
        backgroundColor: 'white',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroLabel: { fontSize: 12, color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    heroValue: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a', marginTop: 8 },

    // Sections
    sectionContainer: { marginBottom: 24, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },

    // Quick Actions
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    actionBtn: { alignItems: 'center', width: '22%' },
    actionIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 8,
    },
    actionLabel: { fontSize: 11, color: '#444', textAlign: 'center', fontWeight: '500' },

    // Month Overview Card
    monthCard: {
        borderRadius: 16,
        backgroundColor: 'white',
        padding: 16,
    },
    gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    statCol: { flex: 1, alignItems: 'center' },
    verticalDivider: { width: 1, height: '80%', alignSelf: 'center' },
    statLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
    statValue: { fontSize: 16, fontWeight: 'bold' },
    
    // Visual Ratio Bar
    ratioBarContainer: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#f0f0f0', marginBottom: 6 },
    ratioBarPart: { height: '100%' },
    ratioLabels: { flexDirection: 'row', justifyContent: 'space-between' },

    // Profit Row
    profitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconSurface: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    profitLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
    profitValue: { fontSize: 18, fontWeight: 'bold' },

    // Previous Months (History) Cards
    historyCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyDateCol: { flex: 1 },
    historyLabel: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
    miniStatRow: { flexDirection: 'row', alignItems: 'center' },
    miniStatText: { fontSize: 12, color: '#666' },
    historyProfitCol: { alignItems: 'flex-end' },
    historyProfitLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
    historyProfitValue: { fontSize: 18, fontWeight: 'bold' },

    // Dues
    duesCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: 'white', elevation: 2 },
    dueAmount: { alignSelf: 'center', fontSize: 14, color: '#d32f2f', fontWeight: 'bold', marginRight: 8 },
    emptyDuesContainer: { padding: 32, alignItems: 'center', justifyContent: 'center' },
    emptyDuesText: { color: '#666', marginTop: 12, fontSize: 14, fontWeight: '500' }
});

export default DashboardScreen;