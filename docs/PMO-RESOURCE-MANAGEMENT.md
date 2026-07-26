# PMO Resource Management

Research pass: 2026-06-22.

## Source Finding

PMO resource management should not be limited to named employees. A resource breakdown structure is used to plan and control project work by resource type/function, and PMBOK-aligned references describe resources broadly enough to include personnel, tools, machinery, materials, equipment, fees, and licenses. Enterprise project tools also commonly treat people, equipment, and materials as resource-pool items with rates, calendars/availability, and assignment costs.

Sources reviewed:

- Resource Breakdown Structure overview, citing PMBOK Guide usage: describes an RBS as a hierarchical list by resource type/function and includes personnel, tools, machinery, materials, equipment, fees, and licenses.  
  https://en.wikipedia.org/wiki/Resource_breakdown_structure
- Project resource definition: project resources can include people, equipment, facilities, funding, and other items required to complete activities; resource availability is a constraint on schedule execution.  
  https://en.wikipedia.org/wiki/Resource_%28project_management%29
- Microsoft Project resource-pool model summary: resources include people, equipment, and materials; resource rates drive assignment costs and shared resource pools support multi-project planning.  
  https://en.wikipedia.org/wiki/Microsoft_Project

## Implementation Rule

Techniek OpsBoard Pro V2 now treats a resource as a capacity/cost object with:

- `type`: Employee, Subcontractor, Tool / Software, Equipment, Facility, Material, Other
- `role`: role, skill, or intended use
- `department`
- `company`: internal organization, subcontracted company, or vendor
- `capacityHrs`: weekly availability or usable capacity
- `costRate`
- `billRate`
- `unit`: hour, use, solver-hour, equipment-hour, etc.
- `status`: Active, Inactive, Preferred, Hold
- `notes`

The resource register can be edited inline and imported/exported as CSV by Admin, Department Manager, and Project Manager roles. Imports merge by resource ID or resource name, preserve existing card assignments, and can add imported resources to named board rosters.

## PMO Director Use Cases

- Replace an internal employee with a subcontracted company while keeping visible rate/capacity impacts.
- Track per-use software or analysis tools as costed resources when they materially affect project cost.
- Track constrained shared equipment so forecasted utilization exposes bottlenecks.
- Maintain preferred/hold vendor status in the same register used for project planning.
- Export/import the register for periodic reconciliation with ERP, HR, procurement, or PMO staffing spreadsheets.

## QA Coverage

`tests/qa.html` group 3 verifies utilization for every resource. Group 3b verifies role-gated management access, subcontractor/tool/equipment sample data, CSV import behavior, board roster assignment, and the CSV template.

