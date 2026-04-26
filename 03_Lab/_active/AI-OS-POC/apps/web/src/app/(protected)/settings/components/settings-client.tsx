"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettingsForm } from "./profile-settings-form"
import { WorkspaceSettingsForm } from "./workspace-settings-form"
import { SmtpSettingsForm } from "./smtp-settings-form"
import { N8nSettingsForm } from "./n8n-settings-form"
import { PlaneIntegrationForm } from "./plane-integration-form"
import { DevToolIntegrationsCard } from "./dev-tool-integrations-card"

export function SettingsClient() {
  const [tab, setTab] = useState("profile")

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          <ProfileSettingsForm />
        </TabsContent>

        <TabsContent value="general" className="pt-4">
          <WorkspaceSettingsForm />
        </TabsContent>

        <TabsContent value="email" className="pt-4">
          <SmtpSettingsForm />
        </TabsContent>

        <TabsContent value="automation" className="pt-4 space-y-6">
          <N8nSettingsForm />
        </TabsContent>

        <TabsContent value="integrations" className="pt-4 space-y-6">
          <PlaneIntegrationForm />
          <DevToolIntegrationsCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
