import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '@/constants/Colors'
import { useColorScheme } from '@/hooks/useColorScheme'

interface SettingsScreenProps {
  onBack?: () => void
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const colorScheme = useColorScheme()
  const colors = Colors[colorScheme ?? 'light']

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.tint }]}>‹ Back</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Settings
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Coming Soon...
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          This page will contain app settings and preferences.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
})
