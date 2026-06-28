import React from "react";
import { Plus, Search, Edit, Trash2, Tags } from "lucide-react";
import http from "../../services/http";
import axios from "axios";
import Button from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import Select from "../ui/Select";
import { APIS } from "../../services/apis";
import { errorNotification, successNotification } from "../ui/Toast";
import { Table } from "../ui/Table";
import { TableSkeleton } from "../ui/TableSkeleton";
import { PageHeader } from "../layout";

interface TicketCategory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  department?: number | null;
  department_name?: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketCategoryRow extends TicketCategory {
  selected?: boolean;
}

interface Department {
  id: number;
  name: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TicketCategory[];
}

export const TicketCategories: React.FC = () => {
  const [categories, setCategories] = React.useState<TicketCategory[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryDescription, setNewCategoryDescription] =
    React.useState("");
  const [newCategoryDepartment, setNewCategoryDepartment] =
    React.useState<string>("");
  const [sortBy, setSortBy] = React.useState<keyof TicketCategoryRow>("name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editingCategory, setEditingCategory] =
    React.useState<TicketCategory | null>(null);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = React.useState<
    number | null
  >(null);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<number[]>([]);
  const [bulkDepartmentId, setBulkDepartmentId] = React.useState<string>("");
  const [bulkUpdating, setBulkUpdating] = React.useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize] = React.useState(10);
  const [totalCount, setTotalCount] = React.useState(0);

  const fetchCategories = async (page: number = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      const response = await http.get<PaginatedResponse>(
        `${APIS.LIST_TICKET_CATEGORIES}?${params}`,
      );

      setCategories(response.data.results);
      setTotalCount(response.data.count);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to fetch ticket categories:", error);
      if (axios.isAxiosError(error)) {
        errorNotification(
          `Failed to load ticket categories: ${error.response?.status} ${error.response?.statusText}`,
        );
      } else {
        errorNotification("Failed to load ticket categories");
      }
    } finally {
      setTimeout(() => setIsLoading(false), 1000);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await http.get(`${APIS.LIST_DEPARTMENTS}?pagination=no`);
      const deptData = response.data?.results || response.data || [];
      setDepartments(deptData);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  React.useEffect(() => {
    fetchCategories(1);
    fetchDepartments();
  }, []);

  // Filter and sort categories locally (for search functionality)
  const filteredAndSortedCategories = React.useMemo(() => {
    return categories
      .filter(
        (category) =>
          category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.description.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a, b) => {
        const sortKey = sortBy === "selected" ? "name" : sortBy;
        const aValue = a[sortKey as keyof TicketCategory];
        const bValue = b[sortKey as keyof TicketCategory];

        if (sortDirection === "asc") {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [categories, searchTerm, sortBy, sortDirection]);

  const tableData: TicketCategoryRow[] = React.useMemo(
    () =>
      filteredAndSortedCategories.map((category) => ({
        ...category,
        selected: selectedCategoryIds.includes(category.id),
      })),
    [filteredAndSortedCategories, selectedCategoryIds],
  );

  const handleSort = (key: keyof TicketCategoryRow) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDirection("asc");
    }
  };

  const handlePageChange = (page: number) => {
    fetchCategories(page);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryDescription.trim()) return;

    setIsSubmitting(true);

    try {
      const categoryData = {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim(),
        department: newCategoryDepartment ? Number(newCategoryDepartment) : null,
      };

      const response = await http.post(
        APIS.CREATE_TICKET_CATEGORY,
        categoryData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      successNotification(
        response.data.message || "Ticket category created successfully",
      );

      // Refresh the categories list after successful creation
      await fetchCategories(currentPage);
      setNewCategoryName("");
      setNewCategoryDescription("");
      setNewCategoryDepartment("");
      setShowCreateModal(false);
    } catch (error: any) {
      console.error("Failed to create ticket category:", error);
      errorNotification(error?.response?.data?.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    // Frontend validation
    if (!editingCategory.name.trim()) {
      errorNotification("Category name cannot be empty");
      return;
    }

    if (!editingCategory.description.trim()) {
      errorNotification("Description is required");
      return;
    }

    if (editingCategory.description.trim().length < 10) {
      errorNotification("Description must be at least 10 characters long");
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryData = {
        name: editingCategory.name.trim(),
        description: editingCategory.description.trim(),
        department: editingCategory.department ?? null,
      };
      await http.patch(
        `${APIS.TICKET_CATEGORIES_BASE}${editingCategory.id}/`,
        categoryData,
      );
      successNotification("Category updated successfully");
      await fetchCategories(currentPage);
      setEditingCategory(null);
    } catch (error: any) {
      console.error("Failed to update ticket category:", error);
      // Show detailed error from backend if available
      const errorMessage = error?.response?.data?.errors 
        ? Object.values(error.response.data.errors).flat().join(', ')
        : error?.response?.data?.message || "Failed to update category";
      errorNotification(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategoryId) return;

    setIsSubmitting(true);
    try {
      await http.delete(`${APIS.TICKET_CATEGORIES_BASE}${deletingCategoryId}/`);
      successNotification("Action was successful");
      await fetchCategories(currentPage);
      setShowDeleteModal(false);
      setDeletingCategoryId(null);
    } catch (error: any) {
      console.error("Failed to delete ticket category:", error);
      errorNotification(error?.response?.data?.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCategorySelection = (id: number, checked: boolean) => {
    setSelectedCategoryIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCategoryIds(filteredAndSortedCategories.map((cat) => cat.id));
    } else {
      setSelectedCategoryIds([]);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkDepartmentId || selectedCategoryIds.length === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all(
        selectedCategoryIds.map((id) =>
          http.patch(`${APIS.TICKET_CATEGORIES_BASE}${id}/`, {
            department: Number(bulkDepartmentId),
          }),
        ),
      );
      successNotification("Categories updated successfully");
      setSelectedCategoryIds([]);
      setBulkDepartmentId("");
      await fetchCategories(currentPage);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "Failed to update categories");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedCategoryIds.length === 0) return;
    setBulkUpdating(true);
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
      await fetchCategories(currentPage);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "Failed to update categories");
    } finally {
      setBulkUpdating(false);
    }
  };

  const columns = [
    {
      key: "selected" as keyof TicketCategoryRow,
      header: "",
      render: (_value: boolean, row: TicketCategoryRow) => (
        <input
          type="checkbox"
          className="rounded"
          checked={!!row.selected}
          onChange={(e) => toggleCategorySelection(row.id, e.target.checked)}
          aria-label={`Select category ${row.name}`}
        />
      ),
    },
    {
      key: "name" as keyof TicketCategory,
      header: "Category Name",
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center space-x-2">
          <Tags className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">
            {value}
          </span>
        </div>
      ),
    },
    {
      key: "description" as keyof TicketCategory,
      header: "Description",
      sortable: true,
      render: (value: string) => (
        <span
          className="text-gray-600 dark:text-[var(--text-primary)] text-sm truncate max-w-xs"
          title={value}
        >
          {value}
        </span>
      ),
    },
    {
      key: "department_name" as keyof TicketCategory,
      header: "Department",
      sortable: true,
      render: (_value: string, row: TicketCategory) => (
        <span className="text-gray-600 dark:text-[var(--text-primary)] text-sm">
          {row.department_name || "Unassigned"}
        </span>
      ),
    },
    {
      key: "created_at" as keyof TicketCategory,
      header: "Created",
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: "id" as keyof TicketCategory,
      header: "Actions",
      render: (id: number, row: TicketCategory) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            icon={Edit}
            onClick={() => setEditingCategory(row)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={() => {
              setDeletingCategoryId(id);
              setShowDeleteModal(true);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="sd-config-content">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Tags className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <span>Ticket Categories</span>
          </span>
        }
        subtitle="Manage ticket categories to organize and classify support tickets"
        actions={
          <Button icon={Plus} onClick={() => setShowCreateModal(true)} size="sm">
            New
          </Button>
        }
      />

      <Input
        icon={Search}
        placeholder="Search ticket categories..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-10 max-w-sm"
      />

        {/* Error State */}
      {error && (
        <div className="rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4">
          <div className="text-[var(--status-danger-text)]">{error}</div>
        </div>
      )}

        {/* Bulk Actions */}
        {!isLoading && !error && categories.length > 0 && selectedCategoryIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--shell-radius)] border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-[var(--text-primary)]">
              <input
                type="checkbox"
                className="rounded"
                checked={
                  filteredAndSortedCategories.length > 0 &&
                  selectedCategoryIds.length === filteredAndSortedCategories.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              Select all
            </label>
            <span className="text-xs text-gray-500">
              {selectedCategoryIds.length} selected
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={bulkDepartmentId}
                onChange={setBulkDepartmentId}
                options={departments.map((dept) => ({
                  value: String(dept.id),
                  label: dept.name,
                }))}
                placeholder="Assign to department..."
                allowSearch
                size="sm"
                className="w-[220px]"
              />
              <Button
                size="sm"
                onClick={handleBulkAssign}
                disabled={!bulkDepartmentId || selectedCategoryIds.length === 0 || bulkUpdating}
              >
                {bulkUpdating ? "Updating..." : "Assign"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkRemove}
                disabled={selectedCategoryIds.length === 0 || bulkUpdating}
              >
                Remove from department
              </Button>
              {selectedCategoryIds.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCategoryIds([])}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Categories Table */}
      {!isLoading && !error && (
        <div className="surface-card overflow-hidden">
          <Table
            data={tableData}
            columns={columns}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
            currentPage={searchTerm ? 1 : currentPage}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            showPagination={!searchTerm}
          />

          {/* Custom pagination info when searching */}
          {searchTerm && (
            <div className="px-6 py-3 border-t border-gray-200 dark:border-[var(--border-color)]">
              <div className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                Showing {filteredAndSortedCategories.length} filtered results
                from {totalCount} total categories
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && categories.length === 0 && (
        <div className="surface-card p-6">
          <div className="text-center">
            <Tags className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
              No ticket categories
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-[var(--text-primary)]">
              Get started by creating a new ticket category.
            </p>
            <div className="mt-6">
              <Button icon={Plus} onClick={() => setShowCreateModal(true)} size="sm">
                New
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewCategoryName("");
          setNewCategoryDescription("");
          setNewCategoryDepartment("");
        }}
        title="Create New Ticket Category"
      >
        <div className="space-y-2">
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            fullWidth
            className="h-10"
          />
          <div>
            <Select
              label="Department (optional)"
              value={newCategoryDepartment}
              onChange={setNewCategoryDepartment}
              options={[
                { value: '', label: 'Unassigned' },
                ...departments.map((dept) => ({
                  value: String(dept.id),
                  label: dept.name,
                })),
              ]}
              placeholder="Unassigned"
              allowSearch
              size="sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-xs text-gray-500">(minimum 10 characters)</span>
            </label>
            <textarea
              placeholder="Enter category description (at least 10 characters)"
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 dark:border-[var(--border-color)] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-gray-100 text-sm"
              rows={2}
            />
            {newCategoryDescription && newCategoryDescription.trim().length < 10 && (
              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                {newCategoryDescription.trim().length}/10 characters (need {10 - newCategoryDescription.trim().length} more)
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={handleCreateCategory}
              disabled={
                !newCategoryName.trim() ||
                !newCategoryDescription.trim() ||
                newCategoryDescription.trim().length < 10 ||
                isSubmitting
              }
              size="sm"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Loader */}
      {isLoading && <TableSkeleton />}

      {/* Edit Category Modal */}
      <Modal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title="Edit Ticket Category"
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={editingCategory?.name || ""}
            onChange={(e) =>
              setEditingCategory(
                editingCategory
                  ? { ...editingCategory, name: e.target.value }
                  : null,
              )
            }
            fullWidth
          />
          <div>
            <Select
              label="Department (optional)"
              value={editingCategory?.department ? String(editingCategory.department) : ""}
              onChange={(value) =>
                setEditingCategory(
                  editingCategory
                    ? {
                        ...editingCategory,
                        department: value ? Number(value) : null,
                      }
                    : null,
                )
              }
              options={[
                { value: '', label: 'Unassigned' },
                ...departments.map((dept) => ({
                  value: String(dept.id),
                  label: dept.name,
                })),
              ]}
              placeholder="Unassigned"
              allowSearch
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Description <span className="text-xs text-gray-500">(minimum 10 characters)</span>
            </label>
            <textarea
              placeholder="Enter category description (at least 10 characters)"
              value={editingCategory?.description || ""}
              onChange={(e) =>
                setEditingCategory(
                  editingCategory
                    ? { ...editingCategory, description: e.target.value }
                    : null,
                )
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-surface-hover dark:text-[var(--text-primary)]"
              rows={3}
            />
            {editingCategory?.description && editingCategory.description.trim().length < 10 && (
              <p className="mt-1 text-sm text-orange-600 dark:text-orange-400">
                {editingCategory.description.trim().length}/10 characters (need {10 - editingCategory.description.trim().length} more)
              </p>
            )}
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              onClick={handleUpdateCategory}
              disabled={
                !editingCategory?.name.trim() ||
                !editingCategory?.description.trim() ||
                editingCategory.description.trim().length < 10 ||
                isSubmitting
              }
            >
              {isSubmitting ? "Updating..." : "Update Category"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Ticket Category"
      >
        <div>
          <p className="text-gray-500 dark:text-[var(--text-primary)]">
            This will permanently delete the selected ticket category. Tickets that used this category
            will be shown as "Uncategorized".
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="danger"
              onClick={handleDeleteCategory}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete Category"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
