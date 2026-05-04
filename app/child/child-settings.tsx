import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDeleteChild } from "@/hooks/queries/useChildren";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Keyboard,
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

interface Parent {
  user_id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
}

interface ChildSettingsProps {
  childName?: string;
  childId?: string;
  onBack?: () => void;
  onChildUpdated?: () => void; // Optional callback when child info is updated
}

export default function ChildSettings({
  childName,
  childId,
  onBack,
  onChildUpdated,
}: ChildSettingsProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ childName?: string; childId?: string }>();
  const resolvedChildName =
    childName ?? (typeof params.childName === "string" ? params.childName : "");
  const resolvedChildId =
    childId ?? (typeof params.childId === "string" ? params.childId : "");
  const handleBack = onBack ?? (() => router.back());
  const colorScheme = useColorScheme();
  const { data: currentUser } = useCurrentUser();
  const deleteChild = useDeleteChild(currentUser?.id);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const refNameInput = useRef<TextInput | null>(null);
  const refBirthDateInput = useRef<TextInput | null>(null);
  const refSearchEmailInput = useRef<TextInput | null>(null);
  const currentScrollYRef = useRef(0);
  const pendingFocusRef = useRef<TextInput | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<Parent[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);

  // Child info editing states
  const [editingChild, setEditingChild] = useState(false);
  const [editedName, setEditedName] = useState(resolvedChildName);
  const [editedBirthDate, setEditedBirthDate] = useState("");
  const [childBirthDate, setChildBirthDate] = useState("");
  const [childAvatarUrl, setChildAvatarUrl] = useState<string | null>(null);
  const [savingChild, setSavingChild] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const getAvatarFileExtension = (asset: ImagePicker.ImagePickerAsset) => {
    const extensionFromName = asset.fileName?.split(".").pop()?.toLowerCase();
    if (extensionFromName) {
      return extensionFromName;
    }

    const extensionFromMime = asset.mimeType?.split("/").pop()?.toLowerCase();
    if (extensionFromMime) {
      return extensionFromMime;
    }

    return "jpg";
  };

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);

      if (pendingFocusRef.current) {
        requestAnimationFrame(() => {
          scrollToFocusedInput(pendingFocusRef.current as TextInput);
          pendingFocusRef.current = null;
        });
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);
      pendingFocusRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToFocusedInput = (inputRef: TextInput | null) => {
    if (!inputRef || !scrollViewRef.current) return;

    inputRef.measureInWindow((_, y) => {
      const windowHeight = Math.max(1, Dimensions.get("window").height);
      const targetY = windowHeight * 0.34;
      const delta = y - targetY;

      if (Math.abs(delta) < 12) return;

      const nextOffset = Math.max(0, currentScrollYRef.current + delta);
      scrollViewRef.current?.scrollTo({ y: nextOffset, animated: true });
    });
  };

  const handleInputFocus = (inputRef: TextInput | null) => {
    if (keyboardVisible) {
      requestAnimationFrame(() => scrollToFocusedInput(inputRef));
      return;
    }

    pendingFocusRef.current = inputRef;
  };

  useEffect(() => {
    fetchParents();
    fetchChildInfo();
  }, []);

  const fetchParents = async () => {
    setLoading(true);
    try {
      // Fetch all user_children links for this child
      const { data: userChildrenData, error: userChildrenError } =
        await supabase
          .from("user_children")
          .select("user_id")
          .eq("child_id", resolvedChildId);

      if (userChildrenError) {
        console.error("Error fetching user_children:", userChildrenError);
        Alert.alert("Error", "Failed to load parents.");
        setLoading(false);
        return;
      }

      if (!userChildrenData || userChildrenData.length === 0) {
        setParents([]);
        setLoading(false);
        return;
      }

      // Get the user IDs
      const userIds = userChildrenData.map((uc) => uc.user_id);

      // Fetch user profiles for those user IDs
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_profiles")
        .select("user_id, email, display_name, first_name, last_name")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        Alert.alert("Error", "Failed to load parent profiles.");
      } else {
        setParents(profilesData || []);
      }
    } catch (error) {
      console.error("Error fetching parents:", error);
      Alert.alert("Error", "Failed to load parents.");
    }
    setLoading(false);
  };

  const fetchChildInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("children")
        .select("name, date_of_birth, avatar_url")
        .eq("id", resolvedChildId)
        .single();

      if (error) {
        console.error("Error fetching child info:", error);
      } else if (data) {
        setEditedName(data.name);
        setChildBirthDate(data.date_of_birth || "");
        setEditedBirthDate(data.date_of_birth || "");
        setChildAvatarUrl(data.avatar_url || null);
      }
    } catch (error) {
      console.error("Error fetching child info:", error);
    }
  };

  const handlePickChildAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Allow photo library access to update the child's avatar.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const selectedAsset = result.assets[0];
    if (!selectedAsset.uri) {
      Alert.alert("Error", "Could not read selected image.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("No user session found.");
      }

      const response = await fetch(selectedAsset.uri);
      const fileBody = await response.arrayBuffer();
      const fileExtension = getAvatarFileExtension(selectedAsset);
      const filePath = `${user.id}/children/${resolvedChildId}/avatar-${Date.now()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, fileBody, {
          contentType: selectedAsset.mimeType || "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Could not generate child avatar URL.");
      }

      const { error: updateError } = await supabase
        .from("children")
        .update({ avatar_url: publicUrlData.publicUrl })
        .eq("id", resolvedChildId);

      if (updateError) {
        throw updateError;
      }

      setChildAvatarUrl(publicUrlData.publicUrl);
      Alert.alert("Success", "Child avatar updated successfully.");
      if (onChildUpdated) {
        onChildUpdated();
      }
    } catch (error) {
      console.error("Error updating child avatar:", error);
      Alert.alert(
        "Error",
        "Failed to update child avatar. Make sure the children table includes avatar_url and your 'avatars' storage bucket policies allow uploads.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const calculateAge = (birthDateString: string): number => {
    if (!birthDateString) return 0;
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleEditChild = () => {
    setEditingChild(true);
  };

  const handleCancelEdit = () => {
    setEditedName(resolvedChildName);
    setEditedBirthDate(childBirthDate);
    setEditingChild(false);
  };

  const handleSaveChild = async () => {
    if (!editedName.trim()) {
      Alert.alert("Error", "Child name cannot be empty.");
      return;
    }

    // Validate date format (YYYY-MM-DD)
    if (editedBirthDate && !/^\d{4}-\d{2}-\d{2}$/.test(editedBirthDate)) {
      Alert.alert(
        "Error",
        "Please use the format YYYY-MM-DD for the birth date.",
      );
      return;
    }

    setSavingChild(true);
    try {
      const { error } = await supabase
        .from("children")
        .update({
          name: editedName.trim(),
          date_of_birth: editedBirthDate || null,
        })
        .eq("id", resolvedChildId);

      if (error) {
        console.error("Error updating child:", error);
        Alert.alert("Error", "Failed to update child information.");
      } else {
        setChildBirthDate(editedBirthDate);
        setEditingChild(false);
        Alert.alert("Success", "Child information updated successfully!");
        // Callback to parent to refresh child info
        if (onChildUpdated) {
          onChildUpdated();
        }
      }
    } catch (error) {
      console.error("Error updating child:", error);
      Alert.alert("Error", "Failed to update child information.");
    }
    setSavingChild(false);
  };

  const handleAddParent = async () => {
    if (!searchEmail.trim()) {
      Alert.alert("Error", "Please enter an email address.");
      return;
    }

    setSearching(true);
    try {
      // Search for user by email
      const { data: userData, error: userError } = await supabase
        .from("user_profiles")
        .select("user_id, email, display_name, first_name, last_name")
        .eq("email", searchEmail.trim().toLowerCase())
        .single();

      if (userError || !userData) {
        Alert.alert("Not Found", "No user found with that email address.");
        setSearching(false);
        return;
      }

      // Check if already linked
      const { data: existingLink } = await supabase
        .from("user_children")
        .select("*")
        .eq("user_id", userData.user_id)
        .eq("child_id", resolvedChildId)
        .single();

      if (existingLink) {
        Alert.alert(
          "Already Added",
          "This parent already has access to this child.",
        );
        setSearching(false);
        return;
      }

      // Add the link
      const { error: linkError } = await supabase
        .from("user_children")
        .insert([{ user_id: userData.user_id, child_id: resolvedChildId }]);

      if (linkError) {
        console.error("Error linking parent:", linkError);
        Alert.alert("Error", "Failed to add parent.");
      } else {
        Alert.alert(
          "Success",
          `${userData.display_name || userData.email} has been granted access to ${resolvedChildName}.`,
        );
        setSearchEmail("");
        fetchParents();
      }
    } catch (error) {
      console.error("Error adding parent:", error);
      Alert.alert("Error", "Failed to add parent.");
    }
    setSearching(false);
  };

  const handleRemoveParent = (parent: Parent) => {
    // Prevent removing the last parent
    if (parents.length <= 1) {
      Alert.alert(
        "Cannot Remove",
        "At least one parent must have access to this child. You cannot remove the last parent.",
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Remove Access",
      `Remove ${parent.display_name || parent.email}'s access to ${resolvedChildName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            (async () => {
              try {
                const { error } = await supabase
                  .from("user_children")
                  .delete()
                  .eq("user_id", parent.user_id)
                  .eq("child_id", resolvedChildId);

                if (error) {
                  console.error("Error removing parent:", error);
                  Alert.alert("Error", "Failed to remove parent.");
                } else {
                  Alert.alert("Success", "Access removed successfully.");
                  fetchParents();
                }
              } catch (error) {
                console.error("Error removing parent:", error);
                Alert.alert("Error", "Failed to remove parent.");
              }
            })();
          },
        },
      ],
    );
  };

  const handleDeleteChild = () => {
    Alert.alert(
      "Delete Child",
      `Delete ${resolvedChildName} and all related calendar, activity, and expense data? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteChild.mutate(resolvedChildId, {
              onSuccess: () => {
                Alert.alert("Deleted", `${resolvedChildName} has been deleted.`);
                router.replace("/(tabs)");
              },
              onError: (error) => {
                console.error("Error deleting child:", error);
                Alert.alert("Error", "Failed to delete child.");
              },
            });
          },
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors[colorScheme ?? "light"].text}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          Settings - {resolvedChildName}
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          keyboardVisible
            ? styles.contentContainerKeyboardOpen
            : styles.contentContainerKeyboardClosed,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        onScroll={(event) => {
          currentScrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* Child Information Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            Child Information
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            Update {resolvedChildName}&apos;s basic information
          </Text>

          <View
            style={[
              styles.childInfoCard,
              {
                backgroundColor: Colors[colorScheme ?? "light"].cardBackground,
                borderColor: Colors[colorScheme ?? "light"].border,
              },
            ]}
          >
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                Avatar
              </Text>
              <View style={styles.avatarRow}>
                <Image
                  source={
                    childAvatarUrl
                      ? { uri: childAvatarUrl }
                      : require("../../assets/images/child_placeholder.png")
                  }
                  style={styles.childAvatarImage}
                />
                <TouchableOpacity
                  style={[
                    styles.changeAvatarButton,
                    {
                      backgroundColor: Colors[colorScheme ?? "light"].primary,
                    },
                  ]}
                  onPress={handlePickChildAvatar}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={18} color="#fff" />
                      <Text style={styles.changeAvatarButtonText}>
                        Change Avatar
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Name Field */}
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                Name
              </Text>
              {editingChild ? (
                <TextInput
                  ref={(ref) => {
                    if (ref) {
                      refNameInput.current = ref;
                    }
                  }}
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? "light"].text,
                      borderColor: Colors[colorScheme ?? "light"].border,
                      backgroundColor:
                        Colors[colorScheme ?? "light"].inputBackground,
                    },
                  ]}
                  placeholder="Enter child's name"
                  placeholderTextColor={
                    Colors[colorScheme ?? "light"].textSecondary
                  }
                  value={editedName}
                  onChangeText={setEditedName}
                  onFocus={() => handleInputFocus(refNameInput.current)}
                />
              ) : (
                <Text
                  style={[
                    styles.infoValue,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  {editedName}
                </Text>
              )}
            </View>

            {/* Birth Date Field */}
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                Birth Date
              </Text>
              {editingChild ? (
                <TextInput
                  ref={(ref) => {
                    if (ref) {
                      refBirthDateInput.current = ref;
                    }
                  }}
                  style={[
                    styles.input,
                    {
                      color: Colors[colorScheme ?? "light"].text,
                      borderColor: Colors[colorScheme ?? "light"].border,
                      backgroundColor:
                        Colors[colorScheme ?? "light"].inputBackground,
                    },
                  ]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={
                    Colors[colorScheme ?? "light"].textSecondary
                  }
                  value={editedBirthDate}
                  onChangeText={setEditedBirthDate}
                  onFocus={() => handleInputFocus(refBirthDateInput.current)}
                />
              ) : (
                <View>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: Colors[colorScheme ?? "light"].text },
                    ]}
                  >
                    {childBirthDate ? formatDate(childBirthDate) : "Not set"}
                  </Text>
                  {childBirthDate && (
                    <Text
                      style={[
                        styles.infoSubtext,
                        { color: Colors[colorScheme ?? "light"].textSecondary },
                      ]}
                    >
                      Age: {calculateAge(childBirthDate)} years old
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Edit/Save Buttons */}
            <View style={styles.childInfoButtons}>
              {editingChild ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.childButton,
                      styles.cancelButton,
                      { borderColor: Colors[colorScheme ?? "light"].border },
                    ]}
                    onPress={handleCancelEdit}
                    disabled={savingChild}
                  >
                    <Text
                      style={[
                        styles.childButtonText,
                        { color: Colors[colorScheme ?? "light"].text },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.childButton,
                      styles.saveButton,
                      {
                        backgroundColor: Colors[colorScheme ?? "light"].primary,
                      },
                    ]}
                    onPress={handleSaveChild}
                    disabled={savingChild}
                  >
                    {savingChild ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                        <Text style={styles.childButtonText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.childButton,
                    styles.editButton,
                    { backgroundColor: Colors[colorScheme ?? "light"].primary },
                  ]}
                  onPress={handleEditChild}
                >
                  <Ionicons name="pencil" size={20} color="#fff" />
                  <Text style={styles.childButtonText}>Edit Information</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Parent Management Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            Parent Access
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            Manage which parents have access to {resolvedChildName}&apos;s information
          </Text>

          {/* Add Parent */}
          <View style={styles.addParentContainer}>
            <TextInput
              ref={(ref) => {
                if (ref) {
                  refSearchEmailInput.current = ref;
                }
              }}
              style={[
                styles.input,
                {
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].border,
                  backgroundColor:
                    Colors[colorScheme ?? "light"].inputBackground,
                },
              ]}
              placeholder="Enter parent's email"
              placeholderTextColor={
                Colors[colorScheme ?? "light"].textSecondary
              }
              value={searchEmail}
              onChangeText={setSearchEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => handleInputFocus(refSearchEmailInput.current)}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: Colors[colorScheme ?? "light"].primary },
              ]}
              onPress={handleAddParent}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.addButtonText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Parents List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={Colors[colorScheme ?? "light"].primary}
              />
            </View>
          ) : (
            <View style={styles.parentsList}>
              {parents.length === 0 ? (
                <Text
                  style={[
                    styles.emptyText,
                    { color: Colors[colorScheme ?? "light"].textSecondary },
                  ]}
                >
                  No parents assigned yet
                </Text>
              ) : (
                parents.map((parent) => (
                  <View
                    key={parent.user_id}
                    style={[
                      styles.parentCard,
                      {
                        backgroundColor:
                          Colors[colorScheme ?? "light"].cardBackground,
                        borderColor: Colors[colorScheme ?? "light"].border,
                      },
                    ]}
                  >
                    <View style={styles.parentInfo}>
                      <View
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor:
                              Colors[colorScheme ?? "light"].primary,
                          },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {(parent.display_name || parent.first_name)
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.parentDetails}>
                        <Text
                          style={[
                            styles.parentName,
                            { color: Colors[colorScheme ?? "light"].text },
                          ]}
                        >
                          {parent.display_name ||
                            `${parent.first_name} ${parent.last_name}`}
                        </Text>
                        <Text
                          style={[
                            styles.parentEmail,
                            {
                              color:
                                Colors[colorScheme ?? "light"].textSecondary,
                            },
                          ]}
                        >
                          {parent.email}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.removeButton,
                        parents.length <= 1 && styles.removeButtonDisabled,
                      ]}
                      onPress={() => handleRemoveParent(parent)}
                      disabled={parents.length <= 1}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={parents.length <= 1 ? "#cccccc" : "#ff4444"}
                      />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: Colors[colorScheme ?? "light"].accent },
            ]}
          >
            Delete Child
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            Permanently remove {resolvedChildName} and all related data from the app.
          </Text>
          <TouchableOpacity
            style={[
              styles.deleteChildButton,
              deleteChild.isPending && styles.deleteChildButtonDisabled,
            ]}
            onPress={handleDeleteChild}
            disabled={deleteChild.isPending}
          >
            {deleteChild.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.deleteChildButtonText}>Delete Child</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: Colors[colorScheme ?? "light"].cardBackground,
              borderColor: Colors[colorScheme ?? "light"].border,
            },
          ]}
        >
          <Ionicons
            name="information-circle"
            size={24}
            color={Colors[colorScheme ?? "light"].primary}
          />
          <Text
            style={[
              styles.infoText,
              { color: Colors[colorScheme ?? "light"].textSecondary },
            ]}
          >
            All parents with access can view and manage {resolvedChildName}&apos;s calendar,
            expenses, and other information.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  contentContainerKeyboardClosed: {
    paddingBottom: 20,
  },
  contentContainerKeyboardOpen: {
    paddingBottom: 240,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  childInfoCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoRow: {
    marginBottom: 20,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  childAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#d8d8d8",
  },
  changeAvatarButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  changeAvatarButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 4,
  },
  childInfoButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  childButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    flex: 1,
  },
  editButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  childButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  addParentContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 5,
    minWidth: 80,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  parentsList: {
    gap: 12,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    paddingVertical: 40,
  },
  parentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  parentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  parentDetails: {
    flex: 1,
  },
  parentName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  parentEmail: {
    fontSize: 14,
  },
  removeButton: {
    padding: 10,
  },
  removeButtonDisabled: {
    opacity: 0.3,
  },
  deleteChildButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    backgroundColor: "#ff4444",
  },
  deleteChildButtonDisabled: {
    opacity: 0.6,
  },
  deleteChildButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    flexDirection: "row",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
