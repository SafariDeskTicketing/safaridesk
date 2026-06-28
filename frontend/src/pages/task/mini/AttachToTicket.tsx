import { useEffect, useState } from "react";
import http from "../../../services/http";
import { APIS } from "../../../services/apis";
import { successNotification, errorNotification } from "../../../components/ui/Toast";
import Select from "../../../components/ui/Select";

type Props = {
    taskId: number,
    close: () => void, 
    reload: () => void,
}
const AttachToTikect: React.FC<Props> = ({ taskId, close, reload }) => {
      const [selectedOption, setSelectedOption] = useState<string>("");
      const [statusDescription, setStatusDescription] = useState<string>("");
      const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
      const [loading, setLoading] = useState<boolean>(false);
      const [tickets, setTickets] = useState([])

      const fetchTickets = async () => {
          try {
          setLoading(true);
          const response = await http.get(`${APIS.LIST_TICKETS}?pagination=no`);
          setTickets(response.data);
          } catch (error: any) {
            errorNotification(error?.response?.data?.message || "An error occurred")
          } finally {
            setLoading(false);
          }
      };

      useEffect(() => {
        fetchTickets();
      }, [])

      const handleAttach = async () => {
        try{

            if(selectedOption === ''){
                errorNotification("Fill all required fields")
                return
            }
            setIsSubmitting(true)

            const response  = await http.post(`${APIS.ATTACH_TASK_TO_TICKET}${taskId}/`, {
                ticket_id: selectedOption
            })

            successNotification(response.data.message)
            setSelectedOption('')
            setStatusDescription('')
            close()
            reload()
        }catch(error: any){
            errorNotification(error?.response?.data?.message || "An error occurred") 
        }finally{
            setIsSubmitting(false)
        }
      }
    

    return (
         <div className="p-6">


             <Select
                  id="status"
                  label="Select Ticket"
                  value={selectedOption}
                  onChange={setSelectedOption}
                  options={[
                    { value: "", label: "Choose ticket...", disabled: true },

                  ...(tickets.length > 0 
                    ? tickets.map(ticket => ({
                        value: ticket?.id || "",
                        label: ticket?.ticket_id || "Unknown Ticket",
                      }))
                    : [{ value: "", label: "No tickets found", disabled: true }]
                  )
                ]}
                  placeholder="Choose ticket..."
                  size="md"
                  required={true}
                  allowSearch={true}
                />
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
                onClick={handleAttach}
                disabled={isSubmitting}
                className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
               {(isSubmitting || loading) ? "Please wait.. ": "Attach"} 
            </button>
            </div>
        </div>
    )
}


export default AttachToTikect