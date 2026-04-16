import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Radio, Activity, ClipboardList, ArrowRight } from 'lucide-react'

export default function PortalHome() {
  const nav = useNavigate()
  return (
    <div className="max-w-screen-lg mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-3">NDT Costing Portal</h1>
        <p className="text-muted-foreground text-lg">Non-Destructive Testing job quoting tools</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav('/rt')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-orange-500" />
              RT Costing Calculator
            </CardTitle>
            <CardDescription>
              Radiographic Testing — X-ray inspection job quotes. Calculates labor, film costs, and pricing across multiple profit scenarios from view parameters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => nav('/rt')}>
              Open RT Costing <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav('/ut')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              UT Price Calculator
            </CardTitle>
            <CardDescription>
              Ultrasonic Testing — 7 geometry types, 30 customers. Computes scan time, per-part price, and full lot pricing with optional weight-based pricing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" onClick={() => nav('/ut')}>
              Open UT Calculator <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => nav('/quotes')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              Quote History
            </CardTitle>
            <CardDescription>
              All submitted UT quotes from portal, API, Salesforce, and email. Filter by customer, source, or status. Click any quote for full breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" onClick={() => nav('/quotes')}>
              View Quotes <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
