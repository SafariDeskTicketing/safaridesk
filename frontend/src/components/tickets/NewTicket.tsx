import React from 'react';
import { CreateTicketModal } from './CreateTicketModal';

/**
 * Wrapper component to render the new ticket creation form outside a modal.
 * Reuses the unified CreateTicketModal to keep parity across entry points.
 */
const NewTicket: React.FC = () => {
  return (
    <div className="p-4 md:p-6">
      <CreateTicketModal loadFromApi />
    </div>
  );
};

export default NewTicket;
