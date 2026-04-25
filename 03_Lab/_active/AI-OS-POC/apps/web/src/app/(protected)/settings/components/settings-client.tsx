"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettingsForm } from "./profile-settings-form"
import { PlaneIntegrationForm } from "./plane-integration-form"

export function SettingsClient() {
  const [tab, setTab] = useState("profile")

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfileSettingsForm />
        </TabsContent>
        <TabsContent value="integrations" className="pt-4 space-y-4">
          <PlaneIntegrationForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}
