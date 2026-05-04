import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAddChild, useChildren } from "@/hooks/queries/useChildren";
import type { Child } from "@/lib/types";
import React, { useState } from "react";
import {
    Alert,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import ChildMenu from "../../components/ChildMenu";
import IOSAlert from "../../components/IOSAlert";
import { useIOSAlert } from "../../hooks/useIOSAlert";
import Activities from "../child/activities";
import Calendar from "../child/calendar";
import ChildSettings from "../child/child-settings";
import Economics from "../child/economics";

type CurrentView =
  | "home"
  | "childMenu"
  | "calendar"
  | "economics"
  | "settings"
  | "activities";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const { showAlert, alertProps } = useIOSAlert();
  const queryClient = useQueryClient();

  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  const { data: items = [] } = useChildren(userId);
  const addChild = useAddChild(userId);

  const [modalVisible, setModalVisible] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildBirthdate, setNewChildBirthdate] = useState("");
  const [currentView, setCurrentView] = useState<CurrentView>("home");
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const handleAddNewChild = async () => {
    if (!newChildName.trim()) {
      showAlert({ message: "Please enter a name for the child.", type: "warning" });
      return;
    }
    if (!userId) {
      showAlert({ message: "No user is currently logged in.", type: "error" });
      return;
    }

    addChild.mutate(
      { name: newChildName, dateOfBirth: newChildBirthdate },
      {
        onSuccess: (child) => {
          showAlert({
            message: `${newChildName} added successfully!`,
            type: "success",
            duration: 3000,
          });
          setNewChildName("");
          setNewChildBirthdate("");
          setModalVisible(false);
        },
        onError: () => {
          showAlert({ message: "Failed to add child.", type: "error" });
        },
      },
    );
  };

  const handleChildPress = (child: Child) => {
    setSelectedChild(child);
    setCurrentView("childMenu");
  };

  const handleBackToHome = () => {
    setCurrentView("home");
    setSelectedChild(null);
  };

  const handleCalendarConfirm = async (_selectedDates: Date[]) => {
    if (!selectedChild) return;
    showAlert({
      message: `Calendar events saved for ${selectedChild.name}!`,
      type: "success",
    });
    setCurrentView("childMenu");
  };

  const handleChildUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["children", userId] }).then(() => {
      if (selectedChild) {
        const refreshed = queryClient.getQueryData<Child[]>(["children", userId]);
        const updated = refreshed?.find((c) => c.id === selectedChild.id);
        if (updated) setSelectedChild(updated);
      }
    });
  };

  if (currentView === "childMenu" && selectedChild) {
    return (
      <ChildMenu
        child={selectedChild}
        onBack={handleBackToHome}
        onCalendar={() => setCurrentView("calendar")}
        onEconomics={() => setCurrentView("economics")}
        onSettings={() => setCurrentView("settings")}
        onActivities={() => setCurrentView("activities")}
      />
    );
  }

  if (currentView === "calendar" && selectedChild) {
    return (
      <Calendar
        childName={selectedChild.name}
        childId={selectedChild.id}
        onConfirm={handleCalendarConfirm}
        onCancel={() => setCurrentView("childMenu")}
      />
    );
  }

  if (currentView === "economics" && selectedChild) {
    return (
      <Economics
        childName={selectedChild.name}
        childId={selectedChild.id}
        onBack={() => setCurrentView("childMenu")}
      />
    );
  }

  if (currentView === "settings" && selectedChild) {
    return (
      <ChildSettings
        childName={selectedChild.name}
        childId={selectedChild.id}
        onBack={() => setCurrentView("childMenu")}
        onChildUpdated={handleChildUpdated}
      />
    );
  }

  if (currentView === "activities" && selectedChild) {
    return (
      <Activities
        childName={selectedChild.name}
        childId={selectedChild.id}
        onBack={() => setCurrentView("childMenu")}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.buttonContainer}>
        {items.length > 0 ? (
          items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.button,
                { backgroundColor: Colors[colorScheme ?? "light"].primary },
              ]}
              onPress={() => handleChildPress(item)}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: Colors[colorScheme ?? "light"].buttonText },
                ]}
              >
                {item.name || "Unknown Item"}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text
            style={[
              styles.noItemsText,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            No items found in database
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.addButton,
            { borderColor: Colors[colorScheme ?? "light"].primary },
          ]}
          onPress={() => setModalVisible(true)}
        >
          <Text
            style={[
              styles.addButtonText,
              { color: Colors[colorScheme ?? "light"].primary },
            ]}
          >
            Add Child
          </Text>
        </TouchableOpacity>
      </View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: Colors[colorScheme ?? "light"].cardBackground,
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Add New Child
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                  borderColor: Colors[colorScheme ?? "light"].border,
                  color: Colors[colorScheme ?? "light"].text,
                },
              ]}
              placeholder="Child's Name"
              placeholderTextColor={Colors[colorScheme ?? "light"].textSecondary}
              value={newChildName}
              onChangeText={setNewChildName}
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                  borderColor: Colors[colorScheme ?? "light"].border,
                  color: Colors[colorScheme ?? "light"].text,
                },
              ]}
              placeholder="Child's Birthdate (YYYY-MM-DD)"
              placeholderTextColor={Colors[colorScheme ?? "light"].textSecondary}
              value={newChildBirthdate}
              onChangeText={setNewChildBirthdate}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: Colors[colorScheme ?? "light"].textSecondary,
                  },
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: Colors[colorScheme ?? "light"].cardBackground },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: Colors[colorScheme ?? "light"].primary },
                ]}
                onPress={handleAddNewChild}
                disabled={addChild.isPending}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: Colors[colorScheme ?? "light"].buttonText },
                  ]}
                >
                  {addChild.isPending ? "Adding..." : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <IOSAlert {...alertProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 40,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
  },
  button: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: "80%",
    alignItems: "center",
  },
  addButton: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: "80%",
    alignItems: "center",
    borderWidth: 2,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  noItemsText: {
    fontSize: 16,
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    borderRadius: 10,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  input: {
    width: "100%",
    padding: 10,
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
