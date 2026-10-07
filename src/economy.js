// Development is paid once when zoning; built lots require ongoing city support,
// including vacant and disconnected buildings. Existing savings are never rewritten.
export const ZONE_ECONOMY = {
  residential: {cost:120,maintenance:[8,26,65,135,400,800]},
  commercial: {cost:180,maintenance:[10,30,80,180,340,650]},
  industrial: {cost:240,maintenance:[16,45,115,225,430,820]},
};
// Money circulating between residents and private employers is kept separate
// from the city budget. The treasury receives income and business taxes, while
// only public-sector payroll is a municipal expense.
export const ECONOMY_RULES={
  residentServiceFee:.4,
  wage:{commercial:24,industrial:28},
  businessTax:{commercial:4.2,industrial:3},
  wageGrowth:[1,1.03,1.06,1.1,1.15,1.2],
  productivity:[1,1.04,1.08,1.13,1.18,1.24],
  publicPayrollRate:.2,
};
const tier=(values,level)=>values[Math.max(0,Math.min(values.length-1,(level||1)-1))];
export const wagePerWorker=b=>(ECONOMY_RULES.wage[b.type]||ECONOMY_RULES.wage.commercial)*tier(ECONOMY_RULES.wageGrowth,b.level);
export const privatePayroll=b=>b.workers*wagePerWorker(b);
export const businessTaxPerWorker=b=>(ECONOMY_RULES.businessTax[b.type]||ECONOMY_RULES.businessTax.commercial)*tier(ECONOMY_RULES.productivity,b.level);
export const privateBusinessTax=(b,taxFactor=1)=>b.workers*businessTaxPerWorker(b)*taxFactor;
export const publicPayroll=facilityOperatingCost=>facilityOperatingCost*ECONOMY_RULES.publicPayrollRate;
export const productivityGain=level=>Math.round((tier(ECONOMY_RULES.productivity,level)-1)*100);
export const economicLotArea=b=>['residential','commercial','industrial'].includes(b.type)?(b.legacyLotArea||(b.footprint||1)**2):1;
export function privateMaintenance(building){
  return (ZONE_ECONOMY[building.type]?.maintenance[(building.level||1)-1]||0)*economicLotArea(building);
}
