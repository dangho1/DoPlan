import { Stack } from 'expo-router'
import React from 'react'

export default function ChildLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="menu" />
      <Stack.Screen name="activities" />
      <Stack.Screen name="child-settings" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="economics" />
      <Stack.Screen name="settings" />
    </Stack>
  )
}
