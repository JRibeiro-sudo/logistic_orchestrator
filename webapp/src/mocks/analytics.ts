/** Synthetic analytics series for the executive dashboard. */
import { makePicker, mulberry32 } from './seed'

const rng = mulberry32(99123)
const R = makePicker(rng)

export interface WeekPoint {
  week: string
  [key: string]: string | number
}

const weeks = ['W20', 'W21', 'W22', 'W23', 'W24', 'W25', 'W26', 'W27', 'W28', 'W29']

export const recoveryTimeTrend = weeks.map((week, i) => ({
  week,
  hours: Math.round(48 - i * 1.8 + R.float(-4, 4)),
}))

export const rootCauseBreakdown = [
  { cause: 'Supplier capacity', count: 14 },
  { cause: 'Transport', count: 11 },
  { cause: 'Upstream supply', count: 8 },
  { cause: 'Demand deviation', count: 7 },
]

export const supplierIncidents = [
  { supplier: 'Jangho Precision', incidents: 9, onTime: 84.2 },
  { supplier: 'Pacific Sensor', incidents: 7, onTime: 87.5 },
  { supplier: 'Danubia Metallwerke', incidents: 6, onTime: 90.1 },
  { supplier: 'Cascadia Polymer', incidents: 5, onTime: 91.4 },
  { supplier: 'Anatolia Isı', incidents: 4, onTime: 93.0 },
  { supplier: 'Vistula Electronics', incidents: 3, onTime: 95.2 },
]

export const problematicMaterials = [
  { material: 'NTC Sensor Module', cases: 7 },
  { material: 'PCB Assembly', cases: 6 },
  { material: 'Compressor Valve', cases: 5 },
  { material: 'Heat Exchanger Fin', cases: 4 },
  { material: 'Gasket Set', cases: 3 },
]

export const transportDelayTrend = weeks.map((week, i) => ({
  week,
  delays: Math.max(0, Math.round(6 + Math.sin(i / 1.6) * 3 + R.float(-1.5, 1.5))),
}))

export const financialImpact = weeks.map((week, i) => ({
  week,
  savedEur: Math.round((32 + i * 4.5 + R.float(-8, 8)) * 1000),
  spentEur: Math.round((9 + R.float(-3, 4)) * 1000),
}))

export const recoveredProductionHours = weeks.map((week, i) => ({
  week,
  hours: Math.round(90 + i * 9 + R.float(-18, 18)),
}))

export const agentPerformance = [
  { agent: 'Triage', successPct: 99.2, avgSec: 6 },
  { agent: 'Transport', successPct: 98.8, avgSec: 38 },
  { agent: 'Demand Dev.', successPct: 97.6, avgSec: 52 },
  { agent: 'Upstream', successPct: 95.4, avgSec: 145 },
  { agent: 'Supplier Cap.', successPct: 93.1, avgSec: 210 },
  { agent: 'Guardrail', successPct: 99.6, avgSec: 74 },
  { agent: 'Synthesis', successPct: 98.9, avgSec: 61 },
]

export const approvalStats = [
  { outcome: 'Approved', count: 61 },
  { outcome: 'Rejected', count: 7 },
  { outcome: 'Escalated', count: 9 },
  { outcome: 'More analysis', count: 5 },
]
