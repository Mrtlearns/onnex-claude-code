import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calculator, Users, Settings, BookOpen, FlaskConical } from 'lucide-react'
import UtCalculatorTab from './UtCalculatorTab'
import UtCustomersTab from './UtCustomersTab'
import UtSettingsTab from './UtSettingsTab'
import RuleSetEditor from './rules/RuleSetEditor'
import UtPipelineTesterTab from './UtPipelineTesterTab'
import { useUtSettings } from '@/lib/ut/hooks/useUtSettings'
import { useUtCustomers } from '@/lib/ut/hooks/useUtCustomers'
import { useUtMaterials } from '@/lib/ut/hooks/useUtMaterials'

export default function UtApp() {
  const { settings, loading: sLoading, update: updateSettings } = useUtSettings()
  const { customers, loading: cLoading, update: updateCustomer, create: createCustomer } = useUtCustomers()
  const { materials, loading: mLoading } = useUtMaterials()
  const [activeTab, setActiveTab] = useState('calculator')
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string | null>(null)

  const loading = sLoading || cLoading || mLoading
  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading UT data…</div>
  if (!settings) return <div className="p-8 text-destructive">Failed to load settings</div>

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">UT Price Calculator</h2>
        <p className="text-sm text-muted-foreground mt-1">{customers.length} customers · {materials.length} materials · 7 geometry types</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calculator"><Calculator className="h-3.5 w-3.5 mr-1.5" />Calculator</TabsTrigger>
          <TabsTrigger value="customers"><Users className="h-3.5 w-3.5 mr-1.5" />Customers</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-3.5 w-3.5 mr-1.5" />Settings</TabsTrigger>
          <TabsTrigger value="rules"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Rules</TabsTrigger>
          <TabsTrigger value="tester"><FlaskConical className="h-3.5 w-3.5 mr-1.5" />Pipeline Tester</TabsTrigger>
        </TabsList>
        <TabsContent value="calculator" className="mt-4">
          <UtCalculatorTab customers={customers} materials={materials} settings={settings} />
        </TabsContent>
        <TabsContent value="customers" className="mt-4">
          <UtCustomersTab customers={customers} onUpdate={updateCustomer} onCreate={createCustomer}
            onSwitchToRules={(rsId) => { setSelectedRuleSetId(rsId); setActiveTab('rules') }} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <UtSettingsTab settings={settings} onUpdate={updateSettings} />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <RuleSetEditor initialRuleSetId={selectedRuleSetId} />
        </TabsContent>
        <TabsContent value="tester" className="mt-4">
          <UtPipelineTesterTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
