import { Ionicons } from '@expo/vector-icons'
import { router, useSegments } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../constants/Colors'
import { useColorScheme } from '../hooks/useColorScheme'

interface CustomHeaderProps {
  title?: string
  showBackButton?: boolean
  onBackPress?: () => void
}

export default function CustomHeader({
  title = '',
  showBackButton = false,
  onBackPress
}: CustomHeaderProps) {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'light']
  const insets = useSafeAreaInsets()
  const segments = useSegments()

  // Check if we're on the profile page
  const isProfilePage = segments.some(segment => segment === 'profile')

  const handleRightButtonPress = () => {
    if (isProfilePage) {
      // Navigate to settings if on profile page
      router.push('/(tabs)/../settings' as any)
    } else {
      // Navigate to profile if on any other page
      router.push('/(tabs)/profile')
    }
  }

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress()
    } else {
      router.back()
    }
  }

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: '#ffffff', // White background like footer buttons
          paddingTop: insets.top + 10,
          borderBottomColor: colors.border
        }
      ]}
    >
      <View style={styles.headerContent}>
        {/* Left side - Back button or spacer */}
        <View style={styles.leftSection}>
          {showBackButton ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.cardBackground }]}
              onPress={handleBackPress}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.spacer} />
          )}
        </View>

        {/* Center - Title */}
        <View style={styles.centerSection}>
          {title ? (
            <Text style={[styles.title, { color: colors.text }]}>
              {title}
            </Text>
          ) : null}
        </View>

        {/* Right side - Profile/Settings button */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            style={[styles.profileButton, { backgroundColor: colors.primary }]}
            onPress={handleRightButtonPress}
          >
            <Ionicons
              name={isProfilePage ? "settings" : "person"}
              size={20}
              color={colors.buttonText}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  spacer: {
    width: 36,
    height: 36,
  },
})
