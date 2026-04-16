import { Database } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import CustomerOrdersTab from './CustomerOrdersTab'
import PartsCatalogTab from './PartsCatalogTab'
import SfChatTab from './SfChatTab'

export default function SfAnalysisApp() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">SF Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Customer order history, parts catalog, and AI-powered SQL queries
          </p>
        </div>
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customer Orders</TabsTrigger>
          <TabsTrigger value="parts">Parts Catalog</TabsTrigger>
          <TabsTrigger value="chat">SF Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <CustomerOrdersTab />
        </TabsContent>

        <TabsContent value="parts" className="mt-4">
          <PartsCatalogTab />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <SfChatTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
