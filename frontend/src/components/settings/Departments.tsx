import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Building2,
  Power,
  Settings as SettingsIcon,
  Users,
  UserPlus,
} from "lucide-react";
import axios from "axios";
import http from "../../services/http";
import Button from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import Select from "../ui/Select";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Table } from "../ui/Table";
import { TableSkeleton } from "../ui/TableSkeleton";
import {
  errorNotification,
  successNotification,
} from "../ui/Toast";
import { APIS } from "../../services/apis";
import { useFetchAgents } from "../../services/agents";
import { AgentType } from "../../types/agents";
import {
  MailIntegration,
  fetchMailIntegrations,
  updateMailIntegrationRouting,
} from "../../services/settings";
import { PageHeader } from "../layout";

interface Department {
  id: number;
  name: string;
  slag: string;
  created_at: string;
  support_email: string;
  status: string;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  department?: number | null;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Department[];
}

interface DepartmentTableRow extends Department {
  activeAgents: number;
  supportEmail: string;
}

export const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newDepartmentName, setNewDepartmentName] = React.useState("");
  const [sortBy, setSortBy] = React.useState<keyof Department>("name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc",
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] =
    React.useState<number | null>(null);
  const [isDeactivating, setIsDeactivating] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);

  const [drawerDepartment, setDrawerDepartment] =
    React.useState<Department | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [generalSaving, setGeneralSaving] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [generalForm, setGeneralForm] = React.useState({
    name: "",
    supportEmail: "",
  });

  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = React.useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = React.useState<number[]>([]);
  const [isAssigningAgents, setIsAssigningAgents] = React.useState(false);
  const [activeDrawerTab, setActiveDrawerTab] =
    React.useState<"general" | "agents" | "categories">("general");
  const [agentSearch, setAgentSearch] = React.useState("");
  const [addAgentSearch, setAddAgentSearch] = React.useState("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = React.useState("");
  const [addCategorySearch, setAddCategorySearch] = React.useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<number[]>([]);
  const [selectedAddCategoryIds, setSelectedAddCategoryIds] = React.useState<number[]>([]);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = React.useState(false);
  const [isUpdatingCategories, setIsUpdatingCategories] = React.useState(false);

  const { data: agentResponse, refetch: refetchAgents } = useFetchAgents();
  const agents: AgentType[] = agentResponse?.results ?? [];

  const { data: integrations } = useQuery<MailIntegration[]>({
    queryKey: ["mailIntegrations"],
    queryFn: fetchMailIntegrations,
  });
  const connectedIntegrations = React.useMemo(
    () =>
      integrations?.filter(
        (integration) => integration.connection_status === "connected",
      ) ?? [],
    [integrations],
  );
  const queryClient = useQueryClient();

  const getIntegrationForDepartment = React.useCallback(
    (departmentId: number) =>
      connectedIntegrations.find(
        (integration) => integration.department === departmentId,
      ),
    [connectedIntegrations],
  );

  const getIntegrationByEmail = React.useCallback(
    (email: string) =>
      connectedIntegrations.find(
        (integration) =>
          (integration.email_address || "").toLowerCase() ===
          email.toLowerCase(),
      ),
    [connectedIntegrations],
  );

  const getSupportEmailForDepartment = React.useCallback(
    (department: Department) =>
      getIntegrationForDepartment(department.id)?.email_address ||
      department.support_email ||
      "",
    [getIntegrationForDepartment],
  );

  const fetchDepartments = async (page: number = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      const response = await http.get<PaginatedResponse>(
        `${APIS.LIST_DEPARTMENTS}?${params}`,
      );
      setDepartments(response.data.results);
      setTotalCount(response.data.count);
      setCurrentPage(page);
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      if (axios.isAxiosError(err)) {
        errorNotification(
          `Failed to load departments: ${err.response?.status} ${err.response?.statusText}`,
        );
      } else {
        errorNotification("Failed to load departments");
      }
      setError("Failed to fetch departments");
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await http.get(`${APIS.LIST_TICKET_CATEGORIES}?pagination=no`);
      const data = response.data?.results || response.data || [];
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  React.useEffect(() => {
    fetchDepartments(1);
  }, []);

  React.useEffect(() => {
    if (drawerDepartment) {
      setGeneralForm({
        name: drawerDepartment.name,
        supportEmail: getSupportEmailForDepartment(drawerDepartment),
      });
    }
  }, [drawerDepartment, getSupportEmailForDepartment]);

  React.useEffect(() => {
    if (isDrawerOpen) {
      setActiveDrawerTab("general");
      setAgentSearch("");
      setAddAgentSearch("");
      setCategorySearch("");
      setAddCategorySearch("");
      setSelectedCategoryIds([]);
      setSelectedAddCategoryIds([]);
      fetchCategories();
    }
  }, [isDrawerOpen]);

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const sortedDepartments = [...filteredDepartments].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    if (a[sortBy] < b[sortBy]) return -1 * direction;
    if (a[sortBy] > b[sortBy]) return direction;
    return 0;
  });

  const buildTableData = (): DepartmentTableRow[] =>
    sortedDepartments.map((dept) => {
      const activeAgents = agents.filter(
        (agent) =>
          agent.is_active &&
          agent.department &&
          Array.isArray(agent.department) &&
          agent.department.some((d) => d.id === dept.id),
      ).length;
      return {
        ...dept,
        activeAgents,
        supportEmail: getSupportEmailForDepartment(dept),
      };
    });

  const openDrawer = (department: Department) => {
    setDrawerDepartment(department);
    setGeneralForm({
      name: department.name,
      supportEmail: getSupportEmailForDepartment(department),
    });
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerDepartment(null);
    setSelectedAgentIds([]);
    setAgentSearch("");
    setAddAgentSearch("");
    setSelectedCategoryIds([]);
    setSelectedAddCategoryIds([]);
    setCategorySearch("");
    setAddCategorySearch("");
    setIsAddCategoryModalOpen(false);
  };

  const handleSort = (key: keyof Department) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDirection("asc");
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDepartmentName.trim()) return;
    setIsLoading(true);
    try {
      await http.post(APIS.CREATE_DEPARTMENT, {
        name: newDepartmentName.trim(),
        support_email: "",
      });
      successNotification("Department created successfully");
      setShowCreateModal(false);
      setNewDepartmentName("");
      await fetchDepartments(currentPage);
    } catch (err: any) {
      errorNotification(
        err?.response?.data?.message ||
          "Failed to create department. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = (id: number) => {
    setSelectedDepartmentId(id);
    setConfirm(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedDepartmentId) return;
    setIsDeactivating(true);
    try {
      await http.put(
        `${APIS.UPDATE_DEPARTMENT_STATUS}${selectedDepartmentId}/`,
      );
      successNotification("Department status updated");
      await fetchDepartments(currentPage);
      refetchAgents();
    } catch (err) {
      errorNotification("Failed to update department status");
    } finally {
      setIsDeactivating(false);
      setConfirm(false);
      setSelectedDepartmentId(null);
    }
  };

  const handleGeneralSave = async () => {
    if (!drawerDepartment) return;
    if (!generalForm.name.trim()) {
      errorNotification("Department name is required");
      return;
    }
    setGeneralSaving(true);

    try {
      const trimmedEmail = generalForm.supportEmail.trim();
      const prevIntegration = getIntegrationForDepartment(drawerDepartment.id);
      const newIntegration = trimmedEmail
        ? getIntegrationByEmail(trimmedEmail)
        : undefined;

      await http.put(`${APIS.UPDATE_DEPARTMENT}${drawerDepartment.id}/`, {
        name: generalForm.name.trim(),
        support_email: trimmedEmail,
      });

      const updates: Promise<any>[] = [];

      if (
        prevIntegration &&
        (!newIntegration || prevIntegration.id !== newIntegration.id)
      ) {
        updates.push(
          updateMailIntegrationRouting(prevIntegration.id, {
            department: null,
          }),
        );
      }

      if (newIntegration) {
        updates.push(
          updateMailIntegrationRouting(newIntegration.id, {
            department: drawerDepartment.id,
          }),
        );
      }

      if (updates.length) {
        await Promise.all(updates);
        queryClient.invalidateQueries({ queryKey: ["mailIntegrations"] });
      }

      successNotification("Department updated successfully");
      setDrawerDepartment((prev) =>
        prev
          ? {
              ...prev,
              name: generalForm.name.trim(),
              support_email: trimmedEmail,
            }
          : prev,
      );
      await fetchDepartments(currentPage);
    } catch (err: any) {
      errorNotification(
        err?.response?.data?.message || "Failed to update department",
      );
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!drawerDepartment) return;
    setStatusUpdating(true);
    try {
      await http.put(`${APIS.UPDATE_DEPARTMENT_STATUS}${drawerDepartment.id}/`);
      successNotification("Department status updated");
      await fetchDepartments(currentPage);
      refetchAgents();
    } catch (err) {
      errorNotification("Failed to update department status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const departmentAgents = drawerDepartment
    ? agents.filter(
        (agent) =>
          agent.department &&
          Array.isArray(agent.department) &&
          agent.department.some((d) => d.id === drawerDepartment.id),
      )
    : [];

  const availableAgents = drawerDepartment
    ? agents.filter(
        (agent) =>
          !agent.department ||
          !Array.isArray(agent.department) ||
          !agent.department.some((d) => d.id === drawerDepartment.id),
      )
    : [];

  const filteredDepartmentAgents = departmentAgents.filter((agent) =>
    `${agent.name} ${agent.email}`
      .toLowerCase()
      .includes(agentSearch.toLowerCase()),
  );

  const filteredAvailableAgents = availableAgents.filter((agent) =>
    `${agent.name} ${agent.email}`
      .toLowerCase()
      .includes(addAgentSearch.toLowerCase()),
  );

  const departmentCategories = drawerDepartment
    ? categories.filter((category) => category.department === drawerDepartment.id)
    : [];

  const availableCategories = drawerDepartment
    ? categories.filter((category) => category.department !== drawerDepartment.id)
    : [];

  const filteredDepartmentCategories = departmentCategories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  const filteredAvailableCategories = availableCategories.filter((category) =>
    category.name.toLowerCase().includes(addCategorySearch.toLowerCase()),
  );

  const handleRemoveCategories = async () => {
    if (!drawerDepartment || selectedCategoryIds.length === 0) return;
    setIsUpdatingCategories(true);
    try {
      await Promise.all(
        selectedCategoryIds.map((id) =>
          http.patch(`${APIS.TICKET_CATEGORIES_BASE}${id}/`, {
            department: null,
          }),
        ),
      );
      successNotification("Categories updated successfully");
      setSelectedCategoryIds([]);
      await fetchCategories();
    } catch (err: any) {
      errorNotification(err?.response?.data?.message || "Failed to update categories");
    } finally {
      setIsUpdatingCategories(false);
    }
  };

  const handleAddCategories = async () => {
    if (!drawerDepartment || selectedAddCategoryIds.length === 0) return;
    setIsUpdatingCategories(true);
    try {
      await Promise.all(
        selectedAddCategoryIds.map((id) =>
          http.patch(`${APIS.TICKET_CATEGORIES_BASE}${id}/`, {
            department: drawerDepartment.id,
          }),
        ),
      );
      successNotification("Categories updated successfully");
      setSelectedAddCategoryIds([]);
      setIsAddCategoryModalOpen(false);
      await fetchCategories();
    } catch (err: any) {
      errorNotification(err?.response?.data?.message || "Failed to update categories");
    } finally {
      setIsUpdatingCategories(false);
    }
  };

  const handleAssignAgents = async () => {
    if (!drawerDepartment || selectedAgentIds.length === 0) return;
    setIsAssigningAgents(true);
    try {
      await Promise.all(
        selectedAgentIds.map((id) => {
          const agent = agents.find((a) => a.id === id);
          if (!agent) return null;
          // Get existing department IDs and add the new one
          const existingDeptIds = Array.isArray(agent.department)
            ? agent.department.map((d) => d.id)
            : [];
          const newDeptIds = [...new Set([...existingDeptIds, drawerDepartment.id])];
          return http.put(`${APIS.UPDATE_AGENT}${agent.id}`, {
            name: agent.name,
            email: agent.email,
            phone_number: agent.phone_number,
            gender: agent.gender,
            departments: newDeptIds,
            role: agent.role,
          });
        }),
      );
      successNotification("Agents added to department");
      setIsAddAgentModalOpen(false);
      setSelectedAgentIds([]);
      setAddAgentSearch("");
      refetchAgents();
      await fetchDepartments(currentPage);
    } catch (err) {
      errorNotification("Failed to add agents");
    } finally {
      setIsAssigningAgents(false);
    }
  };

  const tableData = buildTableData();

  const columns = [
    {
      key: "name" as keyof DepartmentTableRow,
      header: "Department Name",
      sortable: true,
      render: (_: any, row: DepartmentTableRow) => (
        <div>
          <p className="font-semibold text-[var(--text-primary)]">
            {row.name}
          </p>
          <p className="text-[length:var(--font-meta)] text-gray-500">{row.slag}</p>
        </div>
      ),
    },
    {
      key: "activeAgents" as keyof DepartmentTableRow,
      header: "Active Agents",
      render: (value: any) => (
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Users size={14} /> {value}
        </div>
      ),
    },
    {
      key: "status" as keyof DepartmentTableRow,
      header: "Status",
      render: (value: any) => (
        <span
          className={`px-2 py-1 rounded-full text-[length:var(--font-meta)] font-medium ${
            value === "A"
              ? "bg-primary-100 text-primary-800"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {value === "A" ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "supportEmail" as keyof DepartmentTableRow,
      header: "Support Email",
      render: (value: any) => value || "—",
    },
    {
      key: "id" as keyof DepartmentTableRow,
      header: "Actions",
      render: (value: any, row: DepartmentTableRow) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={SettingsIcon}
            onClick={() =>
              openDrawer(
                departments.find((dept) => dept.id === row.id) || row,
              )
            }
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Power}
            onClick={() => handleDeactivate(value)}
          />
        </div>
      ),
    },
  ];

  const paginationInfo = (
    <div className="flex items-center justify-between border-t border-[var(--border-color)] px-4 py-3 bg-gray-50 dark:bg-[#202020]">
      <span className="text-[length:var(--font-body)] text-gray-600 dark:text-gray-400">
        <span className="font-semibold text-[var(--text-primary)]">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)}</span> of{" "}
        <span className="font-semibold text-[var(--text-primary)]">{totalCount}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => fetchDepartments(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 text-[length:var(--font-body)] font-medium rounded-[var(--shell-radius)] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-gray-800 border-gray-300 dark:border-[var(--border-color)] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
        >
          Previous
        </button>
        <span className="text-[length:var(--font-body)] text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-[var(--text-primary)]">{currentPage}</span> / {Math.ceil(totalCount / pageSize)}
        </span>
        <button
          onClick={() =>
            fetchDepartments(currentPage + 1 > Math.ceil(totalCount / pageSize)
              ? currentPage
              : currentPage + 1)
          }
          disabled={currentPage >= Math.ceil(totalCount / pageSize)}
          className="px-4 py-2 text-[length:var(--font-body)] font-medium rounded-[var(--shell-radius)] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-gray-800 border-gray-300 dark:border-[var(--border-color)] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div className="sd-config-content">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <span>Departments</span>
          </span>
        }
        subtitle="Manage departments and assign support agents to handle tickets"
        actions={
          <Button icon={Plus} onClick={() => setShowCreateModal(true)} size="sm">
            New
          </Button>
        }
      />

      <Input
        icon={Search}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search departments..."
        className="h-10 max-w-sm"
      />

      {isLoading && <TableSkeleton />}

      {!isLoading && !error && (
        <div className="surface-card overflow-hidden">
          <Table<DepartmentTableRow>
            data={tableData}
            columns={columns}
            sortBy={sortBy as keyof DepartmentTableRow}
            sortDirection={sortDirection}
            onSort={(key) => handleSort(key as keyof Department)}
            showPagination={false}
          />
          {!searchTerm && paginationInfo}
        </div>
      )}

      {!isLoading && !error && departments.length === 0 && (
        <div className="surface-card p-6">
          <div className="text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-base font-semibold text-[var(--text-primary)]">
              No departments
            </h3>
            <p className="mt-1 text-[length:var(--font-meta)] text-gray-500 dark:text-gray-400">
              Get started by creating a new department.
            </p>
            <div className="mt-4">
              <Button icon={Plus} onClick={() => setShowCreateModal(true)} size="sm">
                New
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewDepartmentName("");
        }}
        title="Create Department"
      >
        <div className="space-y-2">
          <Input
            label="Department Name"
            placeholder="Enter department name"
            value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
            fullWidth
            className="h-10"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={handleCreateDepartment}
              disabled={!newDepartmentName.trim()}
              size="sm"
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={drawerDepartment ? `Department • ${drawerDepartment.name}` : "Department"}
        size="3xl"
        showCloseButton
        closeOnBackdropClick={true}
      >
        {drawerDepartment && (
          <div className="space-y-6 max-w-4xl pr-8 pl-2 mr-auto">
            <div className="flex w-full items-center border-b border-[var(--border-color)]">
              {[
                { id: "general", label: "General settings" },
                { id: "agents", label: "Agents" },
                { id: "categories", label: "Categories" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveDrawerTab(tab.id as "general" | "agents")
                  }
                  className={`flex-1 px-4 py-3 text-[length:var(--font-body)] font-medium text-center border-b-2 cursor-pointer ${
                    activeDrawerTab === tab.id
                      ? "border-primary-600 text-primary-600 dark:text-primary-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeDrawerTab === "general" && (
              <section className="space-y-6">
                <div className="max-w-2xl">
                  <label className="block text-[length:var(--font-label)] text-gray-700 dark:text-[var(--text-primary)] mb-1">
                    Department name
                  </label>
                  <Input
                    value={generalForm.name}
                    onChange={(e) =>
                      setGeneralForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    fullWidth
                  />
                </div>

                <div className="max-w-2xl">
                  <label className="block text-[length:var(--font-label)] text-gray-700 dark:text-[var(--text-primary)] mb-1">
                    Support email
                  </label>
                  <Select
                    value={generalForm.supportEmail}
                    onChange={(value) =>
                      setGeneralForm((prev) => ({
                        ...prev,
                        supportEmail: value,
                      }))
                    }
                    options={[
                      { value: '', label: 'Not assigned' },
                      ...connectedIntegrations.map((integration) => ({
                        value: integration.email_address || '',
                        label: integration.email_address || 'Pending',
                      })),
                    ]}
                    placeholder="Not assigned"
                    allowSearch
                  />
                  <p className="text-[length:var(--font-meta)] text-gray-500 mt-1">
                    Only mailboxes that are connected and assigned to this
                    business will appear here.
                  </p>
                </div>

                <div className="border border-[var(--border-color)] rounded-[var(--shell-radius)] p-4 flex items-center justify-between max-w-2xl">
                  <div>
                    <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                      Department status
                    </p>
                    <p className="text-[length:var(--font-meta)] text-gray-500">
                      {drawerDepartment.status === "A"
                        ? "This department is active and visible to agents."
                        : "This department is inactive and hidden from agents."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Power}
                    onClick={handleStatusToggle}
                    disabled={statusUpdating}
                  >
                    {statusUpdating
                      ? "Updating..."
                      : drawerDepartment.status === "A"
                      ? "Deactivate"
                      : "Activate"}
                  </Button>
                </div>

                <div className="flex justify-end gap-3 max-w-2xl">
                  <Button
                    type="button"
                    onClick={handleGeneralSave}
                    disabled={generalSaving}
                  >
                    {generalSaving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </section>
            )}

            {activeDrawerTab === "agents" && (
              <section className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      className="w-full pl-10 pr-4 py-2 border border-[var(--border-color)] rounded-[var(--shell-radius)] focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]"
                      placeholder="Search agents"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={UserPlus}
                    onClick={() => setIsAddAgentModalOpen(true)}
                    disabled={availableAgents.length === 0}
                  >
                    Add agents
                  </Button>
                </div>

                {filteredDepartmentAgents.length === 0 ? (
                  <p className="text-[length:var(--font-body)] text-gray-500 dark:text-[var(--text-secondary)]">
                    {departmentAgents.length === 0
                      ? "No agents assigned to this department."
                      : "No agents match your search."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredDepartmentAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between border border-gray-200 dark:border-[var(--border-color)] rounded-lg px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {agent.name}
                          </p>
                          <p className="text-[length:var(--font-body)] text-gray-500">{agent.email}</p>
                        </div>
                        <span className="text-[length:var(--font-meta)] text-gray-500">
                          {agent.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeDrawerTab === "categories" && (
              <section className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      className="w-full pl-10 pr-4 py-2 border border-[var(--border-color)] rounded-[var(--shell-radius)] focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]"
                      placeholder="Search categories"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={() => setIsAddCategoryModalOpen(true)}
                    disabled={availableCategories.length === 0}
                  >
                    Add categories
                  </Button>
                </div>

                {filteredDepartmentCategories.length === 0 ? (
                  <p className="text-[length:var(--font-body)] text-gray-500 dark:text-[var(--text-secondary)]">
                    {departmentCategories.length === 0
                      ? "No categories linked to this department."
                      : "No categories match your search."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredDepartmentCategories.map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center gap-3 border border-[var(--border-color)] rounded-[var(--shell-radius)] px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedCategoryIds.includes(category.id)}
                          onChange={(e) => {
                            setSelectedCategoryIds((prev) =>
                              e.target.checked
                                ? [...prev, category.id]
                                : prev.filter((id) => id !== category.id),
                            );
                          }}
                        />
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {category.name}
                          </p>
                          {category.description && (
                            <p className="text-[length:var(--font-body)] text-gray-500">{category.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCategoryIds([])}
                    disabled={selectedCategoryIds.length === 0}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleRemoveCategories}
                    disabled={selectedCategoryIds.length === 0 || isUpdatingCategories}
                  >
                    {isUpdatingCategories ? "Updating..." : "Remove selected"}
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isAddAgentModalOpen}
        onClose={() => {
          setIsAddAgentModalOpen(false);
          setSelectedAgentIds([]);
          setAddAgentSearch("");
        }}
        title="Add agents"
      >
        <div className="space-y-4">
          <Input
            placeholder="Search available agents"
            value={addAgentSearch}
            onChange={(e) => setAddAgentSearch(e.target.value)}
          />

          {availableAgents.length === 0 ? (
            <p className="text-[length:var(--font-body)] text-gray-500">
              All agents are already assigned to this department.
            </p>
          ) : filteredAvailableAgents.length === 0 ? (
            <p className="text-[length:var(--font-body)] text-gray-500">No agents match your search.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-3">
              {filteredAvailableAgents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex items-center gap-3 border border-[var(--border-color)] rounded-[var(--shell-radius)] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedAgentIds.includes(agent.id)}
                    onChange={(e) => {
                      setSelectedAgentIds((prev) =>
                        e.target.checked
                          ? [...prev, agent.id]
                          : prev.filter((id) => id !== agent.id),
                      );
                    }}
                  />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {agent.name}
                    </p>
                    <p className="text-[length:var(--font-body)] text-gray-500">{agent.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleAssignAgents}
              disabled={
                selectedAgentIds.length === 0 ||
                isAssigningAgents ||
                filteredAvailableAgents.length === 0
              }
            >
              {isAssigningAgents ? "Adding..." : "Add agents"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAddCategoryModalOpen}
        onClose={() => {
          setIsAddCategoryModalOpen(false);
          setSelectedAddCategoryIds([]);
          setAddCategorySearch("");
        }}
        title="Add categories"
      >
        <div className="space-y-4">
          <Input
            placeholder="Search available categories"
            value={addCategorySearch}
            onChange={(e) => setAddCategorySearch(e.target.value)}
          />

          {availableCategories.length === 0 ? (
            <p className="text-[length:var(--font-body)] text-gray-500">
              All categories are already linked to this department.
            </p>
          ) : filteredAvailableCategories.length === 0 ? (
            <p className="text-[length:var(--font-body)] text-gray-500">No categories match your search.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-3">
              {filteredAvailableCategories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-3 border border-[var(--border-color)] rounded-[var(--shell-radius)] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedAddCategoryIds.includes(category.id)}
                    onChange={(e) => {
                      setSelectedAddCategoryIds((prev) =>
                        e.target.checked
                          ? [...prev, category.id]
                          : prev.filter((id) => id !== category.id),
                      );
                    }}
                  />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {category.name}
                    </p>
                    {category.description && (
                      <p className="text-[length:var(--font-body)] text-gray-500">{category.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleAddCategories}
              disabled={
                selectedAddCategoryIds.length === 0 ||
                isUpdatingCategories ||
                filteredAvailableCategories.length === 0
              }
            >
              {isUpdatingCategories ? "Adding..." : "Add categories"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        state={isDeactivating}
        cancel={() => setConfirm(false)}
        message="Are you sure you want to toggle this department's status?"
        show={confirm}
        onConfirm={handleDeactivateConfirm}
        variant="danger"
      />
    </div>
  );
};
