import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification } from '../../components/ui/Toast';
import type { TicketData } from '../../types';
import CustomerTicketView from './CustomerTicketView';
import { Loader } from '../../components/loader/loader';
import { CustomerLayout } from './layout/CustomerLayout';

const CustomerTicketViewPage: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await http.get(`${APIS.SEARCH_TICKET}${ticketId}`);
        setTicketData(response.data);
      } catch (error: any) {
        errorNotification(error?.response?.data?.message || "Ticket not found.");
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  if (loading) {
    return <Loader />;
  }

  if (!ticketData) {
    return (
      <CustomerLayout>
        <div className="text-center py-10">Ticket not found</div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <CustomerTicketView ticketData={ticketData} onClose={() => window.history.back()} />
    </CustomerLayout>
  );
};

export default CustomerTicketViewPage;
