import TicketFormSkeleton from "../../components/loader/TicketFormSkeleton"; // Import the skeleton
import { CustomerLayout } from './layout/CustomerLayout'; // Import CustomerLayout
import { CreateTicketModal } from '../../components/tickets/CreateTicketModal';
import { useValidateDomain } from '../../hooks/useValidateDomain';

const Support = () => {
  const { isLoadingDomain, domainError, categories, departments } = useValidateDomain();

  if (isLoadingDomain) {
    return (
      <CustomerLayout>
        <TicketFormSkeleton />
      </CustomerLayout>
    );
  }

  // Only render form if data is successfully loaded
  if (domainError || categories.length === 0 || departments.length === 0) {
    return (
      <CustomerLayout>
        <div className="mx-auto my-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-subtle dark:bg-surface-elevated">
          {domainError && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <strong className="font-semibold">Error: </strong> This help center url is not recognized.
            </div>
          )}
          {!domainError && (categories.length === 0 || departments.length === 0) && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              <strong className="font-semibold">Loading: </strong> Preparing help center form...
            </div>
          )}
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 py-2">
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 to-white px-6 py-5 dark:border-primary-900/40 dark:from-primary-900/20 dark:to-surface-elevated">
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-[var(--text-primary)]">
            Create Support Ticket
          </h1>
          <p className="text-sm text-slate-600 dark:text-[var(--text-muted)]">
            Share your issue and our team will follow up with the right department.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-subtle dark:bg-surface-elevated">
          <CreateTicketModal
            loadFromApi={false}
            categories={categories}
            departments={departments}
            variant="customer"
          />
        </div>
      </div>
    </CustomerLayout>
  );
};

export default Support;
