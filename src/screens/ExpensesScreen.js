/*
================================================================================
File: src/screens/ExpensesScreen.js
Description: Expense Management with Custom Categories and Editing.
*** UPDATED: Removed Icons, Added Edit, Added Custom Category Input ***
================================================================================
*/
import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, FlatList, Modal, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Button, TextInput, FAB, useTheme, IconButton, Chip, Surface, Divider } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addExpense, getExpensesForPeriod, deleteExpense, updateExpense, getUniqueCategories } from '../db/Database'; 
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const DEFAULT_CATEGORIES = ['Cattle feed', 'Borrowed Milk from Dairy', 'Other'];

const ExpensesScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const [expenses, setExpenses] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [availableCategories, setAvailableCategories] = useState(DEFAULT_CATEGORIES);
    
    // Date Filter State
    const [currentDate, setCurrentDate] = useState(new Date()); 

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORIES[0]);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [customCategoryText, setCustomCategoryText] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [editingId, setEditingId] = useState(null); // ID of expense being edited

    // Hide default header
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const loadData = useCallback(() => {
        const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

        // Load Expenses
        getExpensesForPeriod(start, end).then(data => {
            const sorted = data.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
            setExpenses(sorted);
            const total = sorted.reduce((sum, item) => sum + item.amount, 0);
            setTotalAmount(total);
        });

        // Load Unique Categories from DB to populate options
        getUniqueCategories().then(cats => {
            const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...cats]));
            setAvailableCategories(merged);
        });
    }, [currentDate]);

    useFocusEffect(loadData);

    const openModal = (expense = null) => {
        if (expense) {
            // Edit Mode
            setEditingId(expense.id);
            setAmount(String(expense.amount));
            setNote(expense.note || '');
            setSelectedDate(new Date(expense.expense_date));
            
            if (availableCategories.includes(expense.category)) {
                setSelectedCategory(expense.category);
                setIsCustomCategory(false);
            } else {
                setSelectedCategory('Other'); 
                setIsCustomCategory(true);
                setCustomCategoryText(expense.category);
            }
        } else {
            // Add Mode
            setEditingId(null);
            setAmount('');
            setNote('');
            setSelectedDate(new Date());
            setSelectedCategory(DEFAULT_CATEGORIES[0]);
            setIsCustomCategory(false);
            setCustomCategoryText('');
        }
        setModalVisible(true);
    };

    const handleSave = () => {
        if (!amount) {
            Alert.alert('Error', 'Please enter an amount');
            return;
        }
console.log("saving expenses... editingId: "+editingId)
        const categoryToSave = isCustomCategory ? customCategoryText.trim() : selectedCategory;
        if (!categoryToSave) {
            Alert.alert('Error', 'Please specify a category');
            return;
        }

        const payload = {
            id: editingId,
            amount: parseFloat(amount),
            category: categoryToSave,
            note: note,
            date: format(selectedDate, 'yyyy-MM-dd')
        };

        const promise = editingId ? updateExpense(payload) : addExpense(payload);

        promise.then(() => {
            console.log("in promise to save expenses")
            setModalVisible(false);
            loadData();
        });
    };

    const handleDelete = (id) => {
        Alert.alert("Delete Expense", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => {
                deleteExpense(id).then(loadData);
            }}
        ]);
    };

    const changeMonth = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const renderItem = ({ item }) => (
        <Surface style={styles.card} elevation={1}>
            <TouchableOpacity 
                style={styles.cardRow} 
                onPress={() => openModal(item)} // Open edit modal on press
                activeOpacity={0.7}
            >
                {/* Removed Icon Box */}
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.category}</Text>
                    <Text style={styles.cardDate}>
                        {format(new Date(item.expense_date), 'dd MMM')} 
                        {item.note ? ` • ${item.note}` : ''}
                    </Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.amountText}>-₹{item.amount.toFixed(0)}</Text>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                        <Icon name="trash-can-outline" size={20} color="#bbb" style={{marginTop: 4}} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Surface>
    );

    return (
        <View style={styles.container}>
            {/* Custom Header */}
            <View style={[styles.headerBg, { backgroundColor: theme.colors.primary }]}>
                <View style={styles.headerTop}>
                    <IconButton icon="arrow-left" iconColor="white" onPress={() => navigation.goBack()} />
                    <Text style={styles.headerTitle}>My Expenses</Text>
                    <View style={{width: 48}} /> 
                </View>

                {/* Month Navigator & Summary */}
                <View style={styles.summaryContainer}>
                    <View style={styles.monthNav}>
                        <IconButton icon="chevron-left" iconColor="white" size={20} onPress={() => changeMonth(-1)} />
                        <Text style={styles.monthText}>{format(currentDate, 'MMMM yyyy')}</Text>
                        <IconButton icon="chevron-right" iconColor="white" size={20} onPress={() => changeMonth(1)} />
                    </View>
                    <View>
                        <Text style={styles.totalLabel}>Total Spend</Text>
                        <Text style={styles.totalValue}>₹{totalAmount.toLocaleString()}</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={expenses}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="piggy-bank-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No expenses for this month</Text>
                    </View>
                }
            />

            <FAB
                style={[styles.fab, { backgroundColor: theme.colors.accent }]}
                icon="plus"
                color="black"
                label="Add Expense"
                onPress={() => openModal(null)}
            />

            {/* Add/Edit Expense Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingId ? 'Edit Expense' : 'New Expense'}</Text>
                            <IconButton icon="close" size={20} onPress={() => setModalVisible(false)} />
                        </View>
                        <Divider />
                        <Card.Content style={{paddingTop: 16}}>
                            
                            {/* Amount & Date */}
                            <View style={styles.inputRow}>
                                <TextInput
                                    label="Amount (₹)"
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="numeric"
                                    mode="outlined"
                                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                                    autoFocus={!editingId}
                                />
                                <Button 
                                    mode="outlined" 
                                    onPress={() => setShowDatePicker(true)}
                                    style={{justifyContent: 'center', marginTop: 6}}
                                >
                                    {format(selectedDate, 'dd MMM')}
                                </Button>
                            </View>

                            {/* Category Selector */}
                            <Text style={styles.label}>Category</Text>
                            <View style={styles.categoryRow}>
                                {availableCategories.map((cat) => (
                                    <TouchableOpacity 
                                        key={cat}
                                        style={[
                                            styles.categoryChip, 
                                            !isCustomCategory && selectedCategory === cat && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                                        ]}
                                        onPress={() => {
                                            setSelectedCategory(cat);
                                            setIsCustomCategory(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.categoryText, 
                                            !isCustomCategory && selectedCategory === cat && { color: theme.colors.primary, fontWeight: 'bold' }
                                        ]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity 
                                    style={[
                                        styles.categoryChip, 
                                        isCustomCategory && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                                    ]}
                                    onPress={() => setIsCustomCategory(true)}
                                >
                                    <Text style={[
                                        styles.categoryText, 
                                        isCustomCategory && { color: theme.colors.primary, fontWeight: 'bold' }
                                    ]}>+ New</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Custom Category Input */}
                            {isCustomCategory && (
                                <TextInput
                                    label="Enter Category Name"
                                    value={customCategoryText}
                                    onChangeText={setCustomCategoryText}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="e.g. Repairs, Rent"
                                />
                            )}

                            <TextInput
                                label="Note (Optional)"
                                value={note}
                                onChangeText={setNote}
                                mode="outlined"
                                style={styles.input}
                            />

                            <Button mode="contained" onPress={handleSave} style={styles.saveBtn}>
                                {editingId ? 'Update Expense' : 'Save Expense'}
                            </Button>
                        </Card.Content>
                    </Card>
                </View>
            </Modal>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    onChange={(e, date) => { setShowDatePicker(false); if(date) setSelectedDate(date); }}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    
    // Header
    headerBg: {
        paddingTop: 50,
        paddingBottom: 0,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        elevation: 4
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    
    summaryContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: 0, 
        paddingHorizontal: 8 
    },
    monthNav: { flexDirection: 'row', alignItems: 'center' },
    monthText: { color: 'white', fontSize: 16, fontWeight: '500', minWidth: 100, textAlign: 'center' },
    totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'right' },
    totalValue: { color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'right' },

    // List
    listContent: { padding: 16, paddingBottom: 80 },
    card: { 
        backgroundColor: 'white', 
        borderRadius: 12, 
        marginBottom: 12,
        overflow: 'hidden'
    },
    cardRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16 
    },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    cardDate: { fontSize: 12, color: '#888', marginTop: 2 },
    amountText: { fontSize: 16, fontWeight: 'bold', color: '#e53935' },

    // Empty State
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: '#aaa', marginTop: 16, fontSize: 16 },

    // FAB
    fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalCard: { width: '90%', borderRadius: 16, backgroundColor: 'white', paddingBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    
    inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    input: { marginBottom: 16, backgroundColor: 'white' },
    
    label: { fontSize: 14, color: '#666', marginBottom: 8 },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
    categoryChip: { 
        paddingVertical: 6, 
        paddingHorizontal: 12, 
        borderRadius: 20, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        marginRight: 8, 
        marginBottom: 8 
    },
    categoryText: { fontSize: 13, color: '#666' },
    saveBtn: { marginTop: 8 }
});

export default ExpensesScreen;