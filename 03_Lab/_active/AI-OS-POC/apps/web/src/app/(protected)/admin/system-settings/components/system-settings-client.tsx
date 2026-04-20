"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkspaceSettingsForm } from "../../../settings/components/workspace-settings-form"
import { SmtpSettingsForm } from "../../../settings/components/smtp-settings-form"
import { N8nSettingsForm } from "../../../settings/components/n8n-settings-form"
import { IntegrationStatusPanel } from "../../../settings/components/integration-status-panel"
import { DemoDataCard } from "../../../settings/components/demo-data-card"
import { DevToolIntegrationsCard } from "../../../settings/components/dev-tool-integrations-card"

export function SystemSettingsClient() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">System Settings</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="demo">Demo Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <WorkspaceSettingsForm />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <SmtpSettingsForm />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
              <div className="flex-1"><N8nSettingsForm /></div>
              <div className="flex-1"><IntegrationStatusPanel /></div>
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
