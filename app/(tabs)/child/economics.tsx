import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useChildParents,
  useDeleteExpense,
  useExpenses,
  useSaveExpense,
} from "@/hooks/queries/useExpenses";
import type { Expense } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface EconomicsProps {
  childName?: string;
  childId?: string;
  onBack?: () => void;
}

export default function Economics({ childName, childId, onBack }: EconomicsProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ childName?: string; childId?: string }>();
  const resolvedChildName =
    childName ?? (typeof params.childName === "string" ? params.childName : "");
  const resolvedChildId =
    childId ?? (typeof params.childId === "string" ? params.childId : "");
  const handleBack = onBack ?? (() => router.back());
  const colorScheme = useColorScheme();
  const expenseDescriptionAccessoryId = "economicsExpenseDescriptionInputAccessory";
  const expenseAmountAccessoryId = "economicsExpenseAmountInputAccessory";
  const expenseDateAccessoryId = "economicsExpenseDateInputAccessory";

  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  const { data: expenses = [], isLoading } = useExpenses(resolvedChildId);
  const { data: parents = [] } = useChildParents(resolvedChildId);
  const saveExpense = useSaveExpense(resolvedChildId);
  const deleteExpense = useDeleteExpense(resolvedChildId);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"week" | "month" | "year" | "total">(
    "total",
  );

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payer, setPayer] = useState("");

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setPayer("");
    setEditingExpense(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (expense: Expense) => {
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setDate(expense.date);
    setPayer(expense.payer);
    setEditingExpense(expense);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!description.trim() || !amount.trim() || !date.trim() || !payer.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (!userId) {
      Alert.alert("Error", "Failed to get user information");
      return;
    }

    saveExpense.mutate({
      expense: {
        description: description.trim(),
        amount: numericAmount,
        date,
        payer: payer.trim(),
      },
      userId,
      editingId: editingExpense?.id,
    }, {
      onSuccess: () => {
        setModalVisible(false);
        resetForm();
      },
      onError: () => Alert.alert("Error", "Failed to save expense"),
    });
  };

  const handleDelete = (expenseId: string) => {
    Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteExpense.mutate(expenseId, {
            onError: () => Alert.alert("Error", "Failed to delete expense"),
          });
        },
      },
    ]);
  };

  const getParentDisplayName = (parent: (typeof parents)[0]) => {
    if (parent.display_name) return parent.display_name;
    return `${parent.first_name} ${parent.last_name}`.trim() || parent.email;
  };

  const toLocalDate = (dateString: string) => new Date(`${dateString}T00:00:00`);

  const getFilteredExpenses = (filter: "week" | "month" | "year" | "total") => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === "week") {
      const dayOfWeek = startOfToday.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - mondayOffset);
      return expenses.filter((e) => toLocalDate(e.date) >= startOfWeek);
    }
    if (filter === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return expenses.filter((e) => toLocalDate(e.date) >= startOfMonth);
    }
    if (filter === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return expenses.filter((e) => toLocalDate(e.date) >= startOfYear);
    }
    return expenses;
  };

  const getTotalExpenses = () =>
    getFilteredExpenses(timeFilter).reduce((t, e) => t + e.amount, 0);

  const getTotalsByPayer = () => {
    const totals: Record<
      string,
      { week: number; month: number; year: number; total: number }
    > = {};

    const accumulate = (entries: Expense[], key: "week" | "month" | "year" | "total") => {
      entries.forEach((e) => {
        const p = e.payer?.trim() || "Unknown";
        if (!totals[p]) totals[p] = { week: 0, month: 0, year: 0, total: 0 };
        totals[p][key] += e.amount;
      });
    };

    accumulate(getFilteredExpenses("week"), "week");
    accumulate(getFilteredExpenses("month"), "month");
    accumulate(getFilteredExpenses("year"), "year");
    accumulate(getFilteredExpenses("total"), "total");

    return Object.entries(totals)
      .map(([payerName, totalsByPeriod]) => ({ payerName, totalsByPeriod }))
      .sort((a, b) => b.totalsByPeriod.total - a.totalsByPeriod.total);
  };

  const getFilterLabel = () => {
    if (timeFilter === "week") return "This Week";
    if (timeFilter === "month") return "This Month";
    if (timeFilter === "year") return "This Year";
    return "Total";
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <View
      style={[
        styles.expenseItem,
        { backgroundColor: Colors[colorScheme ?? "light"].cardBackground },
      ]}
    >
      <View style={styles.expenseContent}>
        <View style={styles.expenseHeader}>
          <Text
            style={[
              styles.expenseDescription,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            {item.description}
          </Text>
          <Text
            style={[
              styles.expenseAmount,
              { color: Colors[colorScheme ?? "light"].tint },
            ]}
          >
            {formatCurrency(item.amount)}
          </Text>
        </View>
        <View style={styles.expenseDetails}>
          <Text
            style={[
              styles.expenseDate,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            {formatDate(item.date)}
          </Text>
          <Text
            style={[
              styles.expensePayer,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            Paid by: {item.payer}
          </Text>
        </View>
      </View>
      <View style={styles.expenseActions}>
        <TouchableOpacity
          onPress={() => openEditModal(item)}
          style={[
            styles.actionButton,
            { backgroundColor: Colors[colorScheme ?? "light"].tint },
          ]}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: Colors[colorScheme ?? "light"].buttonText },
            ]}
          >
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={[
            styles.actionButton,
            { backgroundColor: Colors[colorScheme ?? "light"].accent },
          ]}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: Colors[colorScheme ?? "light"].buttonText },
            ]}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: Colors[colorScheme ?? "light"].background },
        ]}
      >
        <View style={styles.loadingContainer}>
          <Text
            style={[styles.loadingText, { color: Colors[colorScheme ?? "light"].text }]}
          >
            Loading expenses...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors[colorScheme ?? "light"].text}
          />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: Colors[colorScheme ?? "light"].text }]}
        >
          Expenses - {resolvedChildName}
        </Text>
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: Colors[colorScheme ?? "light"].cardBackground },
          ]}
        >
          <Text
            style={[styles.summaryTitle, { color: Colors[colorScheme ?? "light"].text }]}
          >
            Total Expenses - {getFilterLabel()}
          </Text>

          <View style={styles.filterContainer}>
            {(["week", "month", "year", "total"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      timeFilter === f
                        ? Colors[colorScheme ?? "light"].tint
                        : Colors[colorScheme ?? "light"].inputBackground,
                    borderColor: Colors[colorScheme ?? "light"].border,
                  },
                ]}
                onPress={() => setTimeFilter(f)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    {
                      color:
                        timeFilter === f
                          ? Colors[colorScheme ?? "light"].buttonText
                          : Colors[colorScheme ?? "light"].text,
                    },
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text
            style={[
              styles.summaryAmount,
              { color: Colors[colorScheme ?? "light"].tint },
            ]}
          >
            {formatCurrency(getTotalExpenses())}
          </Text>
          <Text
            style={[
              styles.summaryCount,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            {getFilteredExpenses(timeFilter).length}{" "}
            {getFilteredExpenses(timeFilter).length === 1 ? "expense" : "expenses"}
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: Colors[colorScheme ?? "light"].cardBackground },
          ]}
        >
          <Text
            style={[styles.summaryTitle, { color: Colors[colorScheme ?? "light"].text }]}
          >
            Per Person Totals
          </Text>
          <View
            style={[
              styles.payerTotalsHeader,
              { borderBottomColor: Colors[colorScheme ?? "light"].border },
            ]}
          >
            {["Person", "W", "M", "Y", "T"].map((label) => (
              <Text
                key={label}
                style={[
                  label === "Person" ? styles.payerNameHeader : styles.payerPeriodHeader,
                  { color: Colors[colorScheme ?? "light"].textSecondary },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          {getTotalsByPayer().length === 0 ? (
            <Text
              style={[
                styles.noPayerTotalsText,
                { color: Colors[colorScheme ?? "light"].textLight },
              ]}
            >
              No expenses yet
            </Text>
          ) : (
            getTotalsByPayer().map(({ payerName, totalsByPeriod }) => (
              <View
                key={payerName}
                style={[
                  styles.payerTotalsRow,
                  { borderBottomColor: Colors[colorScheme ?? "light"].border },
                ]}
              >
                <Text
                  style={[
                    styles.payerNameCell,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                  numberOfLines={1}
                >
                  {payerName}
                </Text>
                {(["week", "month", "year", "total"] as const).map((period) => (
                  <Text
                    key={period}
                    style={[
                      styles.payerPeriodCell,
                      {
                        color: Colors[colorScheme ?? "light"].text,
                        fontWeight: period === "total" ? "700" : "400",
                      },
                    ]}
                  >
                    {formatCurrency(totalsByPeriod[period])}
                  </Text>
                ))}
              </View>
            ))
          )}
          <Text
            style={[
              styles.payerTotalsLegend,
              { color: Colors[colorScheme ?? "light"].textLight },
            ]}
          >
            W = week, M = month, Y = year, T = total
          </Text>
        </View>

        <TouchableOpacity
          onPress={openAddModal}
          style={[
            styles.addButton,
            { backgroundColor: Colors[colorScheme ?? "light"].tint },
          ]}
        >
          <Text
            style={[
              styles.addButtonText,
              { color: Colors[colorScheme ?? "light"].buttonText },
            ]}
          >
            Add New Expense
          </Text>
        </TouchableOpacity>

        <FlatList
          data={expenses}
          renderItem={renderExpenseItem}
          keyExtractor={(item) => item.id}
          style={styles.expensesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: Colors[colorScheme ?? "light"].textSecondary },
                ]}
              >
                No expenses yet
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: Colors[colorScheme ?? "light"].textLight },
                ]}
              >
                Tap "Add New Expense" to get started
              </Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? "light"].cardBackground },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                {editingExpense ? "Edit Expense" : "Add New Expense"}
              </Text>

              <View style={styles.inputContainer}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Description
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                      color: Colors[colorScheme ?? "light"].text,
                      borderColor: Colors[colorScheme ?? "light"].border,
                    },
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What was this expense for?"
                  placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
                  inputAccessoryViewID={
                    Platform.OS === "ios" ? expenseDescriptionAccessoryId : undefined
                  }
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Amount
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                      color: Colors[colorScheme ?? "light"].text,
                      borderColor: Colors[colorScheme ?? "light"].border,
                    },
                  ]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
                  keyboardType="numeric"
                  inputAccessoryViewID={
                    Platform.OS === "ios" ? expenseAmountAccessoryId : undefined
                  }
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Date
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                      color: Colors[colorScheme ?? "light"].text,
                      borderColor: Colors[colorScheme ?? "light"].border,
                    },
                  ]}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
                  inputAccessoryViewID={
                    Platform.OS === "ios" ? expenseDateAccessoryId : undefined
                  }
                  keyboardType={
                    Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
                  }
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Who Paid?
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    {
                      backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                      borderColor: Colors[colorScheme ?? "light"].border,
                    },
                  ]}
                  onPress={() => setShowPayerDropdown(!showPayerDropdown)}
                >
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      {
                        color: payer
                          ? Colors[colorScheme ?? "light"].text
                          : Colors[colorScheme ?? "light"].textLight,
                      },
                    ]}
                  >
                    {payer || "Select who paid"}
                  </Text>
                  <Text
                    style={[
                      styles.dropdownArrow,
                      { color: Colors[colorScheme ?? "light"].text },
                    ]}
                  >
                    {showPayerDropdown ? "▲" : "▼"}
                  </Text>
                </TouchableOpacity>

                {showPayerDropdown && (
                  <View
                    style={[
                      styles.dropdownList,
                      {
                        backgroundColor: Colors[colorScheme ?? "light"].cardBackground,
                        borderColor: Colors[colorScheme ?? "light"].border,
                      },
                    ]}
                  >
                    {parents.length > 0 ? (
                      parents.map((parent) => (
                        <TouchableOpacity
                          key={parent.user_id}
                          style={[
                            styles.dropdownItem,
                            {
                              backgroundColor:
                                payer === getParentDisplayName(parent)
                                  ? `${Colors[colorScheme ?? "light"].tint}20`
                                  : "transparent",
                            },
                          ]}
                          onPress={() => {
                            setPayer(getParentDisplayName(parent));
                            setShowPayerDropdown(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              { color: Colors[colorScheme ?? "light"].text },
                            ]}
                          >
                            {getParentDisplayName(parent)}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.dropdownItem}>
                        <Text
                          style={[
                            styles.dropdownItemText,
                            { color: Colors[colorScheme ?? "light"].textSecondary },
                          ]}
                        >
                          No parents found
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={[
                    styles.modalButton,
                    styles.cancelButton,
                    {
                      backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                      borderColor: Colors[colorScheme ?? "light"].border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      { color: Colors[colorScheme ?? "light"].text },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saveExpense.isPending}
                  style={[
                    styles.modalButton,
                    styles.saveButton,
                    { backgroundColor: Colors[colorScheme ?? "light"].tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      { color: Colors[colorScheme ?? "light"].buttonText },
                    ]}
                  >
                    {saveExpense.isPending
                      ? "Saving..."
                      : editingExpense
                        ? "Update"
                        : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {Platform.OS === "ios" && (
              <>
                {[
                  expenseDescriptionAccessoryId,
                  expenseAmountAccessoryId,
                  expenseDateAccessoryId,
                ].map((id) => (
                  <InputAccessoryView key={id} nativeID={id}>
                    <View
                      style={[
                        styles.keyboardAccessory,
                        {
                          backgroundColor:
                            Colors[colorScheme ?? "light"].cardBackground,
                          borderTopColor: Colors[colorScheme ?? "light"].border,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.keyboardAccessoryDoneButton}
                        onPress={Keyboard.dismiss}
                      >
                        <Text
                          style={[
                            styles.keyboardAccessoryDoneText,
                            { color: Colors[colorScheme ?? "light"].tint },
                          ]}
                        >
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </InputAccessoryView>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 15,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 24, fontWeight: "bold", flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 18, textAlign: "center" },
  summaryCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  summaryAmount: { fontSize: 32, fontWeight: "bold", marginBottom: 4 },
  summaryCount: { fontSize: 14 },
  payerTotalsHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginTop: 4,
  },
  payerTotalsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  payerNameHeader: { flex: 1.6, fontSize: 12, fontWeight: "700" },
  payerPeriodHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  payerNameCell: { flex: 1.6, fontSize: 14, fontWeight: "600", paddingRight: 8 },
  payerPeriodCell: { flex: 1, fontSize: 12, textAlign: "right" },
  noPayerTotalsText: { marginTop: 12, fontSize: 14, textAlign: "center" },
  payerTotalsLegend: { marginTop: 10, fontSize: 11, textAlign: "right" },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 16,
    justifyContent: "space-between",
    width: "100%",
    alignSelf: "stretch",
  },
  filterButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  filterButtonText: { fontSize: 14, fontWeight: "600" },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addButtonText: { fontSize: 16, fontWeight: "600" },
  expensesList: { flex: 1 },
  expenseItem: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  expenseContent: { flex: 1 },
  expenseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  expenseDescription: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 12 },
  expenseAmount: { fontSize: 16, fontWeight: "bold" },
  expenseDetails: { flexDirection: "row", justifyContent: "space-between" },
  expenseDate: { fontSize: 14 },
  expensePayer: { fontSize: 14 },
  expenseActions: { flexDirection: "column", gap: 8, marginLeft: 12 },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: "center",
  },
  actionButtonText: { fontSize: 12, fontWeight: "600" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  emptySubtext: { fontSize: 14, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
  },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  textInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  dropdownButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownButtonText: { fontSize: 16, flex: 1 },
  dropdownArrow: { fontSize: 12, marginLeft: 8 },
  dropdownList: { borderWidth: 1, borderRadius: 8, marginTop: 8, maxHeight: 200 },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dropdownItemText: { fontSize: 16 },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButton: {},
  saveButton: {},
  modalButtonText: { fontSize: 16, fontWeight: "600" },
  keyboardAccessory: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  keyboardAccessoryDoneButton: { paddingHorizontal: 8, paddingVertical: 4 },
  keyboardAccessoryDoneText: { fontSize: 17, fontWeight: "600" },
});
