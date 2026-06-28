import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Mail, Phone, Edit, Loader2, Archive, RotateCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../../components/ui/Toast';
import { PageCard, PageHeader } from '../../components/layout';

interface Contact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
  created_at?: string;
  organization?: string;
  is_active?: boolean;
  ticket_count?: number;
}

interface TicketSummary {
  id: number;
  ticket_id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

const emptyForm = { name: '', email: '', phone: '', notes: '', tags: '' };

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'C';

const ContactPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [closedTicketCount, setClosedTicketCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveModal, setArchiveModal] = useState<{ show: boolean; contact: Contact | null; ticketCount: number }>({ show: false, contact: null, ticketCount: 0 });
  const [archiving, setArchiving] = useState(false);

  const fetchContacts = async ({
    page = currentPage,
    query = appliedSearchTerm,
    archived = showArchived,
  }: { page?: number; query?: string; archived?: boolean } = {}) => {
    const params = {
      page,
      page_size: pageSize,
      search: query || undefined,
      show_archived: archived ? 'true' : 'false',
    };
    // Show cached data instantly while background fetch runs
    const cacheKey = ['contacts', params];
    const cached = queryClient.getQueryData<{ results: Contact[]; count: number }>(cacheKey);
    if (cached?.results) {
      setContacts(cached.results);
      setTotalCount(cached.count ?? cached.results.length);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const response = await http.get(APIS.CONTACTS, { params });
      const raw = response.data;
      const data: Contact[] = Array.isArray(raw) ? raw : raw?.results || raw?.data || [];
      const count: number = Array.isArray(raw) ? data.length : raw?.count ?? data.length;
      queryClient.setQueryData(cacheKey, { results: data, count });
      setContacts(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      errorNotification('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const fetchContactDetail = async (contact: Contact) => {
    setDetailLoading(true);
    try {
      const res = await http.get(`${APIS.CONTACTS}${contact.id}/`);
      const detail = res.data;
      setSelectedContact(detail);

      // Load recent tickets by matching email
      if (detail?.email) {
        const ticketsRes = await http.get(APIS.LIST_TICKETS, {
          params: { search: detail.email, page_size: 5 },
        });
        const ticketData = Array.isArray(ticketsRes.data)
          ? ticketsRes.data
          : ticketsRes.data?.results || [];
        setTickets(ticketData);
        
        // Calculate open and closed ticket counts
        const openCount = ticketData.filter(t => t.status !== 'closed').length;
        const closedCount = ticketData.filter(t => t.status === 'closed').length;
        setOpenTicketCount(openCount);
        setClosedTicketCount(closedCount);
      } else {
        setTickets([]);
        setOpenTicketCount(0);
        setClosedTicketCount(0);
      }
    } catch (error) {
      console.error('Error loading contact detail:', error);
      errorNotification('Failed to load contact details');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts({ page: currentPage, query: appliedSearchTerm, archived: showArchived });
  }, [currentPage, appliedSearchTerm, showArchived]);

  // Real-time: refresh contacts on WebSocket contact_event (create/update/archive by any agent)
  useEffect(() => {
    const handler = () => fetchContacts({ page: currentPage, query: appliedSearchTerm, archived: showArchived });
    window.addEventListener('contact_event', handler);
    return () => window.removeEventListener('contact_event', handler);
  }, [currentPage, appliedSearchTerm, showArchived]);

  const filteredContacts = useMemo(() => contacts, [contacts]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalCount);

  const openCreate = () => {
    setFormMode('create');
    setFormData(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (contact: Contact) => {
    setFormMode('edit');
    setFormData({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      tags: (contact.tags || []).join(', '),
    });
    setShowFormModal(true);
    setSelectedContact(contact);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      errorNotification('Name is required');
      return;
    }
    if (!formData.email.trim() && !formData.phone.trim()) {
      errorNotification('Provide at least email or phone');
      return;
    }

    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      notes: formData.notes,
      tags: formData.tags
        ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };
    try {
      if (formMode === 'create') {
        await http.post(APIS.CONTACTS, payload);
        successNotification('Contact created');
      } else if (selectedContact) {
        await http.put(`${APIS.CONTACTS}${selectedContact.id}/`, payload);
        successNotification('Contact updated');
      }
      setShowFormModal(false);
      setSelectedContact(null);
      setFormData(emptyForm);
      fetchContacts({ page: currentPage, query: appliedSearchTerm, archived: showArchived });
    } catch (error: any) {
      console.error('Save contact error:', error);
      const data = error?.response?.data;
      const detail =
        data?.email?.[0] ||
        data?.message ||
        data?.detail ||
        'Failed to save contact';
      errorNotification(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveContact = (contact: Contact) => {
    setArchiveModal({ show: true, contact, ticketCount: contact.ticket_count ?? 0 });
  };

  const handleDeactivate = async () => {
    if (!archiveModal.contact) return;
    setArchiving(true);
    try {
      await http.patch(`${APIS.CONTACTS}${archiveModal.contact.id}/archive/`);
      successNotification('Contact archived');
      setArchiveModal({ show: false, contact: null, ticketCount: 0 });
      if (selectedContact?.id === archiveModal.contact.id) {
        setSelectedContact(null);
        setTickets([]);
      }
      fetchContacts({ page: currentPage, query: appliedSearchTerm, archived: showArchived });
    } catch (error) {
      console.error('Archive contact error:', error);
      errorNotification('Failed to archive contact');
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (contactId: number) => {
    try {
      await http.patch(`${APIS.CONTACTS}${contactId}/restore/`);
      successNotification('Contact restored');
      fetchContacts({ page: currentPage, query: appliedSearchTerm, archived: showArchived });
    } catch (error) {
      console.error('Restore contact error:', error);
      errorNotification('Failed to restore contact');
    }
  };

  const toggleShowArchived = () => {
    setCurrentPage(1);
    setShowArchived((current) => !current);
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Contacts"
        subtitle="Manage customer contacts for your workspace"
        actions={
          <Button icon={Plus} onClick={openCreate}>
            New Contact
          </Button>
        }
      />

      <PageCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            icon={Search}
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Button
            variant="outline"
            onClick={() => {
              setCurrentPage(1);
              setAppliedSearchTerm(searchTerm.trim());
            }}
          >
            Apply
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSearchTerm('');
              setAppliedSearchTerm('');
              setShowArchived(false);
              setCurrentPage(1);
            }}
          >
            Reset
          </Button>
          <Button
            variant={showArchived ? 'outline' : 'ghost'}
            icon={Archive}
            onClick={toggleShowArchived}
            style={showArchived ? { borderColor: 'var(--status-warning-border)', color: 'var(--status-warning-text)' } : undefined}
          >
            {showArchived ? 'Show active' : 'Show archived'}
          </Button>
        </div>
      </PageCard>

      <PageCard className="divide-y divide-[var(--border-color)]" padding="none">
        {loading ? (
          <div className="divide-y divide-[var(--border-color)]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="sd-shimmer h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="sd-shimmer h-3.5 w-1/3" />
                  <div className="sd-shimmer h-3 w-1/2" />
                </div>
                <div className="sd-shimmer h-3 w-20" />
              </div>
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-6 text-[length:var(--font-body)] text-[var(--text-secondary)]">No contacts found.</div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-[var(--hover-bg)] transition"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] flex items-center justify-center font-semibold"
                  style={contact.is_active === false ? { opacity: 0.6 } : undefined}
                >
                  {initials(contact.name || '')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">{contact.name}</span>
                    {contact.is_active === false && (
                      <span
                        className="text-[length:var(--font-meta)] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)' }}
                      >
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-[length:var(--font-meta)] text-[var(--text-secondary)] flex items-center gap-2">
                    {contact.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={14} /> {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={14} /> {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-[length:var(--font-label)] font-medium hover:underline"
                  style={{ color: 'hsl(var(--primary-600-hsl))' }}
                  onClick={() => fetchContactDetail(contact)}
                >
                  View details
                </button>
                <div className="relative flex items-center gap-2">
                  {contact.is_active !== false && (
                    <Button variant="ghost" size="sm" icon={Edit} onClick={() => openEdit(contact)} />
                  )}
                  {contact.is_active === false ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => handleRestore(contact.id)}
                      title="Restore contact"
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Archive}
                      onClick={() => handleArchiveContact(contact)}
                      disabled={archiving && archiveModal.contact?.id === contact.id}
                      title="Archive contact"
                    />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </PageCard>

      {/* Contact Details Drawer (Modal) */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-[13px] text-gray-600 dark:text-[var(--text-primary)]">
          <span>
            Showing {pageStart}-{pageEnd} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextPage = Math.max(1, currentPage - 1);
                setCurrentPage(nextPage);
              }}
              disabled={loading || currentPage <= 1}
            >
              Previous
            </Button>
            <span className="min-w-20 text-center">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextPage = Math.min(totalPages, currentPage + 1);
                setCurrentPage(nextPage);
              }}
              disabled={loading || currentPage >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedContact}
        onClose={() => { setSelectedContact(null); setTickets([]); }}
        title="Contact Details"
        size="lg"
      >
        {detailLoading && (
          <div className="flex items-center gap-2 text-[length:var(--font-body)] text-[var(--text-secondary)]">
            <Loader2 className="animate-spin" size={18} /> Loading...
          </div>
        )}
        {!detailLoading && selectedContact && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center font-semibold"
                style={{ backgroundColor: 'hsl(var(--primary-600-hsl))', color: 'hsl(var(--primary-foreground))' }}
              >
                {initials(selectedContact.name || '')}
              </div>
              <div>
                <div className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]"
                     style={{ fontWeight: 'var(--font-weight-title)' }}>
                  {selectedContact.name}
                </div>
                <div className="text-[length:var(--font-meta)] text-[var(--text-secondary)] flex gap-2 flex-wrap">
                  {selectedContact.email && (
                    <span className="inline-flex items-center gap-1"><Mail size={12} /> {selectedContact.email}</span>
                  )}
                  {selectedContact.phone && (
                    <span className="inline-flex items-center gap-1"><Phone size={12} /> {selectedContact.phone}</span>
                  )}
                </div>
              </div>
            </div>

            {selectedContact.organization && (
              <div>
                <div className="mb-1 text-[length:var(--font-meta)] font-medium uppercase tracking-wide text-[var(--text-muted)]">Organization</div>
                <p className="text-[length:var(--font-body)] font-medium text-[var(--text-primary)]">
                  {selectedContact.organization}
                </p>
              </div>
            )}

            {/* Ticket Statistics */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border-color)]">
              <div className="text-center">
                <div className="text-stat-value" style={{ color: 'var(--status-info-text)' }}>{openTicketCount}</div>
                <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">Open Tickets</p>
              </div>
              <div className="text-center">
                <div className="text-stat-value" style={{ color: 'hsl(var(--primary-600-hsl))' }}>{closedTicketCount}</div>
                <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">Closed Tickets</p>
              </div>
            </div>

            {selectedContact.tags && selectedContact.tags.length > 0 && (
              <div>
                <div className="mb-1 pt-2 text-[length:var(--font-meta)] font-medium uppercase tracking-wide text-[var(--text-muted)]">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {selectedContact.tags.map((tag) => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedContact.notes && (
              <div>
                <div className="mb-1 text-[length:var(--font-meta)] font-medium uppercase tracking-wide text-[var(--text-muted)]">Notes</div>
                <p className="text-[length:var(--font-body)] text-[var(--text-primary)] whitespace-pre-line">
                  {selectedContact.notes}
                </p>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">Recent tickets</h3>
                <Badge variant="default">{tickets.length}</Badge>
              </div>
              {tickets.length === 0 ? (
                <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">No tickets linked to this contact yet.</p>
              ) : (
                <ul className="space-y-2">
                  {tickets.map((t) => (
                    <li
                      key={t.id}
                      className="p-3 rounded-[var(--shell-radius)] bg-[var(--surface-subtle)] border border-[var(--border-color)] transition hover:border-[hsl(var(--primary-600-hsl))]"
                    >
                      <a href={`/ticket/${t.ticket_id}`} className="block">
                        <div className="flex items-center justify-between">
                          <div className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">{t.title}</div>
                          <Badge variant="default">{t.ticket_id}</Badge>
                        </div>
                        <div className="mt-1 flex gap-3 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                          <span>Status: {t.status}</span>
                          <span>Priority: {t.priority}</span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {selectedContact.is_active !== false && (
                <Button variant="outline" onClick={() => openEdit(selectedContact)}>
                  Edit Contact
                </Button>
              )}
              {selectedContact.is_active === false ? (
                <Button
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => {
                    handleRestore(selectedContact.id);
                    setSelectedContact(null);
                    setTickets([]);
                  }}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => handleArchiveContact(selectedContact)}
                  disabled={archiving && archiveModal.contact?.id === selectedContact.id}
                  icon={Archive}
                >
                  Archive
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Contact Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => { setShowFormModal(false); setFormData(emptyForm); }}
        title={formMode === 'create' ? 'New Contact' : 'Edit Contact'}
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Tags (comma separated)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Notes</label>
            <textarea
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': 'hsl(var(--primary-600-hsl))' } as React.CSSProperties}
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowFormModal(false); setFormData(emptyForm); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} icon={saving ? Loader2 : undefined}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Archive warning modal — contact has linked tickets, offer deactivation */}
      <Modal
        isOpen={archiveModal.show}
        onClose={() => setArchiveModal({ show: false, contact: null, ticketCount: 0 })}
        title="Archive Contact"
        size="sm"
      >
        <div className="space-y-4">
          {archiveModal.ticketCount > 0 ? (
            <>
              <p className="text-[length:var(--font-body)] text-[var(--text-primary)]">
                This contact cannot be deleted because they are associated with{' '}
                <strong>{archiveModal.ticketCount}</strong> ticket{archiveModal.ticketCount !== 1 ? 's' : ''}.
              </p>
              <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
                Please archive the contact instead. The contact will be hidden from active lists, but ticket history stays intact.
              </p>
            </>
          ) : (
            <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
              Archive <strong className="text-[var(--text-primary)]">{archiveModal.contact?.name}</strong>? The contact will be hidden from the active list and can be restored from Show archived.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setArchiveModal({ show: false, contact: null, ticketCount: 0 })}>
              Cancel
            </Button>
            <Button
              onClick={handleDeactivate}
              disabled={archiving}
              icon={archiving ? Loader2 : Archive}
            >
              {archiving ? 'Archiving...' : 'Archive Contact'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ContactPage;
