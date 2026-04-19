"use client"

import { ProfileSettingsForm } from "./profile-settings-form"

export function SettingsClient() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
      <ProfileSettingsForm />
    </div>
  )
}
