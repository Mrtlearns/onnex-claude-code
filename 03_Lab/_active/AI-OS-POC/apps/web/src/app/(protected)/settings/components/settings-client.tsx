"use client"
// apps/web/src/app/(protected)/settings/components/settings-client.tsx
// 3-tab layout: General | Email | Integrations

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettingsForm } from "./profile-settings-form"
import { WorkspaceSettingsForm } from "./workspace-settings-form"
import { SmtpSettingsForm } from "./smtp-settings-form"
import { N8nSettingsForm } from "./n8n-settings-form"
import { IntegrationStatusPanel } from "./integration-status-panel"
import { DemoDataCard } from "./demo-data-card"
import { DevToolIntegrationsCard } from "./dev-tool-integrations-card"

export function SettingsClient() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="demo">Demo Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettingsForm />
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <WorkspaceSettingsForm />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <SmtpSettingsForm />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
              <div className="flex-1">
                <N8nSettingsForm />
              </div>
              <div className="flex-1">
                <IntegrationStatusPanel />
              </div>
            </div>
            <DevToolIntegrationsCard />
          </div>
        </TabsContent>

        <TabsContent value="demo" className="mt-6 max-w-2xl">
          <DemoDataCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
