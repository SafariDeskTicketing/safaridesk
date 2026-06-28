import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification } from '../../../components/ui/Toast';
import Spinner from '../../../components/ui/DataLoader';
import { CustomerLayout } from '../layout/CustomerLayout';
import CustomerTicketView from '../CustomerTicketView';
import { useValidateDomain } from '../../../hooks/useValidateDomain';
import type { TicketData } from '../../../types';

const TicketViewPage: React.FC = () => {
  const { ticket_id } = useParams<{ ticket_id: string }>();
  const { businessId } = useValidateDomain();
  const [loading, setLoading] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true);
      try {
        const response = await http.post(`${APIS.SEARCH_TICKET}${ticket_id}`, {
          businessId: businessId,
        });
        setTicketData(response.data);
      } catch (error: any) {
        errorNotification(error?.response?.data?.message || "Failed to load ticket details.");
      } finally {
        setLoading(false);
      }
    };

    if (ticket_id) {
      fetchTicket();
    }
  }, [ticket_id, businessId]);

  return (
    <CustomerLayout>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      ) : ticketData ? (
        <CustomerTicketView ticketData={ticketData} onClose={() => window.history.back()} />
      ) : (
        <div className="text-center py-10">
          <p className="text-gray-500">Ticket not found or an error occurred.</p>
        </div>
      )}
    </CustomerLayout>
  );
};

export default TicketViewPage;
