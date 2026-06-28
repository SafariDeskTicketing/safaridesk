import { useEffect, useState } from "react";
import http from "../../../services/http";
import { APIS } from "../../../services/apis";
import { successNotification, errorNotification } from "../../../components/ui/Toast";
import type { Agent } from "../../../types";
import Select from "../../../components/ui/Select";
import { getActiveAgents } from "../../../services/agents";

type Props = {
    taskId: number,
    close: () => void, 
    reload: () => void,
}
const AssignTask: React.FC<Props> = ({ taskId, close, reload }) => {
      const [selectedOption, setSelectedOption] = useState<string>("");
      const [statusDescription, setStatusDescription] = useState<string>("");
      const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
      const [loading, setLoading] = useState<boolean>(false);
      const [agents, setAgents] = useState<Agent[] | null >(null)

      const fetchAgents = async () => {
          try {
          setLoading(true);
          const response = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
          setAgents(getActiveAgents(response.data));
          } catch (error: any) {
            errorNotification(error?.response?.data?.message || "An error occurred")
          } finally {
            setLoading(false);
          }
      };

      useEffect(() => {
        fetchAgents();
      }, [])

      const handleAssign = async () => {
        try{

            if(selectedOption === ''){
                errorNotification("Fill all required fields")
                return
            }
            setIsSubmitting(true)

            const response  = await http.post(`${APIS.ASSIGN_TASK}${taskId}/`, {
                user_id: selectedOption
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
              label="Select Agent"
              value={selectedOption}
              onChange={setSelectedOption}
              options={[
                { value: "", label: "Choose agent...", disabled: true },
                ...(agents && agents.length > 0 
                  ? agents.map(agent => ({
                      value: agent.id.toString(), // ✅ convert number to string
                      label: agent.name || "Unknown Agent"
                    }))
                  : [{ value: "", label: "No agents found", disabled: true }]
                )
              ]}
              placeholder="Choose agent..."
              size="md"
              required={true}
              allowSearch={true}
            />
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
                onClick={handleAssign}
                disabled={isSubmitting}
                className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
               {isSubmitting ? "Please wait.. ": "Reassign"} 
            </button>
            </div>
        </div>
    )
}


export default AssignTask