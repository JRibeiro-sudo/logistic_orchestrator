from pipeline.specialists.demand_deviation import DemandDeviationBranch
from pipeline.specialists.supplier_capacity import SupplierCapacityBranch
from pipeline.specialists.transport import TransportBranch
from pipeline.specialists.upstream_supply import UpstreamSupplyBranch

BRANCH_REGISTRY = {
    "supplier_capacity": SupplierCapacityBranch(),
    "upstream_supply": UpstreamSupplyBranch(),
    "transport": TransportBranch(),
    "demand_deviation": DemandDeviationBranch(),
}
