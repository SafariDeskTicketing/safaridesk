import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "../ui/data-table"
import { Checkbox } from "../ui/checkbox"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

interface Asset {
  id: number;
  name: string;
  description: string;
  serial_number: string;
  category: string;
  vendor: string;
  brand: string;
  model: string;
  status: string;
  condition: string;
  location: string;
  purchase_price: number;
  purchase_date: string;
  supplier: string;
  invoice_number: string;
  warranty_start_date: string; // Added
  warranty_end_date: string;   // Added
  last_maintenance: string;
  next_maintenance: string;
  notes: string;
  is_critical: boolean;
}

interface AssetListProps {
  assets: Asset[];
}

export const columns: ColumnDef<Asset>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "name",
    header: "Asset Name",
  },
  {
    accessorKey: "serial_number",
    header: "Serial Number",
  },
  {
    accessorKey: "category",
    header: "Category",
  },
  {
    accessorKey: "vendor",
    header: "Vendor",
  },
  {
    accessorKey: "brand",
    header: "Brand",
  },
  {
    accessorKey: "model",
    header: "Model",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "condition",
    header: "Condition",
  },
  {
    accessorKey: "location",
    header: "Location",
  },
  {
    accessorKey: "purchase_price",
    header: "Purchase Price",
  },
  {
    accessorKey: "purchase_date",
    header: "Purchase Date",
  },
  {
    accessorKey: "supplier",
    header: "Supplier",
  },
  {
    accessorKey: "invoice_number",
    header: "Invoice Number",
  },
  {
    accessorKey: "warranty_start_date",
    header: "Warranty Start Date",
  },
  {
    accessorKey: "warranty_end_date",
    header: "Warranty End Date",
  },
  {
    accessorKey: "last_maintenance",
    header: "Last Maintenance",
  },
  {
    accessorKey: "next_maintenance",
    header: "Next Maintenance",
  },
  {
    accessorKey: "notes",
    header: "Notes",
  },
  {
    accessorKey: "is_critical",
    header: "Is Critical",
    cell: ({ row }) => (row.original.is_critical ? "Yes" : "No"),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const asset = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              ... {/* Ellipsis icon */}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(asset.id.toString())}
            >
              Copy asset ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View Asset</DropdownMenuItem>
            <DropdownMenuItem>Edit Asset</DropdownMenuItem>
            <DropdownMenuItem>Delete Asset</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

const AssetList: React.FC<AssetListProps> = ({ assets }) => {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredAssets = assets.filter(asset =>
    Object.values(asset).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Asset List</h2>
      <div className="flex items-center py-4">
        <Input
          placeholder="Search assets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <DataTable columns={columns} data={filteredAssets} />
    </div>
  )
}

export default AssetList;