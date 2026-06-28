import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { fetchDepartmentEmails, updateDepartmentEmail, createDepartmentEmail, fetchAllDepartments } from '../../services/settings';
import { Button } from '../ui/Button';
import { DataTable } from '../ui/DataTable';
import { formatDate } from '../../utils/date';
import { UpdateEmailModal } from './UpdateEmailModal';
import { TableSkeleton } from '../ui/TableSkeleton';

export const Emails: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const { data, isLoading, error } = useQuery({
    queryKey: ['departmentEmails', page],
    queryFn: () => fetchDepartmentEmails(page),
    placeholderData: (previousData) => previousData,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; data: any }) => updateDepartmentEmail(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentEmails'] });
      toast.success('Email settings updated successfully');
      setIsModalOpen(false);
    },
    onError: () => {
      toast.error('Failed to update email settings');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createDepartmentEmail(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departmentEmails'] });
      toast.success('Department email added successfully');
      setIsModalOpen(false);
    },
    onError: () => {
      toast.error('Failed to add department email');
    },
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departmentList'],
    queryFn: fetchAllDepartments,
  });
  const departmentOptions = Array.isArray(departmentsData?.results)
    ? departmentsData?.results
    : Array.isArray(departmentsData)
      ? departmentsData
      : [];

  const handleAddClick = () => {
    setSelectedEmail(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleUpdateClick = (email: any) => {
    setSelectedEmail(email);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEmail(null);
  };

  const handleUpdate = (formData: any) => {
    if (modalMode === 'edit' && selectedEmail) {
      updateMutation.mutate({ id: selectedEmail.id, data: formData });
    } else if (modalMode === 'create') {
      createMutation.mutate(formData);
    }
  };

  const modalEmail = modalMode === 'edit' ? selectedEmail : null;
  const shouldShowModal = isModalOpen && (modalMode === 'create' || !!selectedEmail);

  const columns = [
    {
      header: 'Email',
      accessorKey: 'email',
    },
    {
      header: 'Status',
      accessorKey: 'is_active',
      cell: ({ row }: any) => (row.original.is_active ? 'Active' : 'Inactive'),
    },
    {
      header: 'Created At',
      accessorKey: 'created_at',
      cell: ({ row }: any) => formatDate(row.original.created_at),
    },
    {
      header: 'Updated At',
      accessorKey: 'updated_at',
      cell: ({ row }: any) => formatDate(row.original.updated_at),
    },
    {
      header: 'Actions',
      cell: ({ row }: any) => (
        <Button onClick={() => handleUpdateClick(row.original)}>
          Update
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (error) {
    return <div>Error loading emails</div>;
  }

  return (
    <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[length:var(--font-section-title)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">
          Department Emails
        </h2>
        <Button onClick={handleAddClick}>
          Add Email
        </Button>
      </div>
      <DataTable columns={columns} data={data?.results ?? []} />
      <div className="flex justify-between mt-4">
        <Button onClick={() => setPage(page - 1)} disabled={!data.previous}>
          Previous
        </Button>
        <Button onClick={() => setPage(page + 1)} disabled={!data.next}>
          Next
        </Button>
      </div>
      {shouldShowModal && (
        <UpdateEmailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          email={modalEmail}
          mode={modalMode}
          onSubmit={handleUpdate}
          departments={departmentOptions}
        />
      )}
    </div>
  );
};
