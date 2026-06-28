import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Shield, 
  Calendar, 
  Plus, 
  CheckCircle, 
  Edit, 
  Save,
  X,
  HelpCircle,
  Target,
  Briefcase
} from 'lucide-react';
import Drawer from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import BusinessHoursForm from './mini/BusinessHoursForm';
import PolicyComponent from './mini/PoliciesComponent';
import BusinessHoursInline from './mini/BusinessHoursInline';
import PolicyForm from './mini/PolicyForm';
import HolidayForm from './mini/HolidayForm';
import HolidayComponent from './mini/HolidayComponent';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import { PageHeader } from '../../components/layout';

export const SlaPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('policies');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showBusinessHoursModal, setShowBusinessHoursModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [modalType, setModalType] = useState('');
  const [businessHoursCount, setBusinessHoursCount] = useState(0);
  const [policiesCount, setPoliciesCount] = useState(0);
  const [slaId, setSlaId] = useState<string | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [showSlaInfo, setShowSlaInfo] = useState(false);
  
  // SLA Configuration toggles
  const [slaEnabled, setSlaEnabled] = useState(false);
  const [allowHolidays, setAllowHolidays] = useState(true);
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Load SLA configuration from backend
  useEffect(() => {
    const loadSLAConfig = async () => {
      try {
        setLoadingConfig(true);
        const response = await http.get(APIS.SLA_CONFIG);
        
        if (response.data && response.data.data) {
          const config = response.data.data;
          setSlaEnabled(config.sla_enabled ?? false);
        }
      } catch (error: any) {
        console.error('Error loading SLA config:', error);
        errorNotification('Failed to load SLA configuration');
      } finally {
        setLoadingConfig(false);
      }
    };

    loadSLAConfig();
  }, []);

  // Save SLA enabled state to backend
  const handleSlaEnabledChange = async () => {
    const newValue = !slaEnabled;
    
    try {
      await http.patch(APIS.SLA_CONFIG, {
        sla_enabled: newValue
      });
      
      setSlaEnabled(newValue);
      successNotification(`SLA tracking ${newValue ? 'enabled' : 'disabled'} successfully`);
    } catch (error: any) {
      console.error('Error updating SLA config:', error);
      errorNotification('Failed to update SLA configuration');
    }
  };

  const openModal = (type: string) => {
    setModalType(type);
    setShowDrawer(true);
  };

  const CustomToggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const TabButton = ({ id, label, icon: Icon, active }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
        active
          ? 'bg-primary-600 text-white shadow-md'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#202020]'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

 
  return (
    <div className="w-full">
      <PageHeader
        title="Service Level Agreements"
        subtitle="Configure SLA policies, business hours, and holidays for response and resolution targets."
      />
      <div className="space-y-6">
        {/* What is SLA - Info Box */}
        {showSlaInfo && (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <HelpCircle size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">What is SLA?</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Service Level Agreement (SLA)</strong> is a commitment between a service provider and customer that defines the expected level of service.
                  In ticketing systems, SLAs set target response and resolution times based on ticket priority. This helps teams:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 ml-2">
                  <li><strong>Prioritize work</strong> - Critical issues get faster attention</li>
                  <li><strong>Meet commitments</strong> - Track performance against targets</li>
                  <li><strong>Improve service</strong> - Identify bottlenecks and optimize workflows</li>
                  <li><strong>Build trust</strong> - Set clear expectations with customers</li>
                </ul>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  <strong>Note:</strong> SLA tracking is disabled by default. Configure your policies below, then activate SLA to start monitoring ticket performance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSlaInfo(false)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-blue-600 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40 transition"
                aria-label="Close SLA information"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* SLA Tracking Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">SLA Tracking is {slaEnabled ? 'Enabled' : 'Disabled'}</h3>
                {!showSlaInfo && (
                  <button
                    type="button"
                    onClick={() => setShowSlaInfo(true)}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition"
                    aria-expanded={showSlaInfo}
                    aria-label="Toggle SLA information"
                    title="Show SLA info"
                  >
                    <HelpCircle size={14} />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enable SLA tracking to monitor ticket response and resolution times against defined policies.
              </p>
            </div>
            <CustomToggle checked={slaEnabled} onChange={handleSlaEnabledChange} />
          </div>
        </div>

        {/* SLA Disabled State - Show feature cards */}
        {!slaEnabled ? (
          <div className="space-y-6">
            {/* Icon and Title */}
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <Clock size={48} className="text-gray-400 dark:text-gray-500" />
              </div>
              <h2 className="text-[length:var(--font-section-title)] font-semibold text-gray-900 dark:text-white mb-2">SLA Tracking is Disabled</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xl">
                Enable SLA tracking above to access powerful features including:
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* SLA Policies Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Target size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">SLA Policies</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Define response and resolution time targets for different priorities
                </p>
              </div>

              {/* Business Hours Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Briefcase size={24} className="text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Business Hours</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set your working hours to calculate SLA times accurately
                </p>
              </div>

              {/* Holidays Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Calendar size={24} className="text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Holidays</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage holidays when SLA timers should pause automatically
                </p>
              </div>
            </div>

            {/* Bottom message */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Once enabled, you'll be able to create policies, configure business hours, and manage holidays to ensure accurate SLA tracking.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-[var(--border-color)]">
              <TabButton
                id="policies"
                label="SLA Policies"
                icon={Shield}
                active={activeTab === 'policies'}
              />
              <TabButton
                id="business-hours"
                label="Business Hours"
                icon={Clock}
                active={activeTab === 'business-hours'}
              />
              <TabButton
                id="holidays"
                label="Holidays"
                icon={Calendar}
                active={activeTab === 'holidays'}
              />
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-[var(--border-color)]">
              {/* Tab Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--border-color)]">
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                      {activeTab === 'policies' && 'SLA Policies'}
                      {activeTab === 'business-hours' && 'Business Hours'}
                      {activeTab === 'holidays' && 'Holidays'}
                    </h2>
                    {activeTab === 'policies' && null}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {activeTab === 'policies' && 'Define response and resolution timeframes for different priorities'}
                    {activeTab === 'business-hours' && 'Configure working hours for SLA calculations'}
                    {activeTab === 'holidays' && 'Manage holidays that affect SLA timings'}
                  </p>
                </div>
                {/* Add buttons - only show for policies and holidays */}
                {activeTab === 'policies' && (
                  <button
                    onClick={() => navigate('/config/sla/add')}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-semibold text-sm"
                  >
                    <Plus size={16} />
                    Add Policy
                  </button>
                )}
                {activeTab === 'holidays' && (
                  <button
                    onClick={() => setShowHolidayModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-semibold text-sm"
                  >
                    <Plus size={16} />
                    New Holiday
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="p-4">
                {/* SLA Policies */}
                {activeTab === 'policies' && (
                  <PolicyComponent reload={reloadTrigger} setPoliciesCount={setPoliciesCount} />
                )}

                {/* Business Hours */}
                {activeTab === 'business-hours' && (
                  <BusinessHoursInline />
                )}
                
                {/* Holidays */}
                {activeTab === 'holidays' && (
                  <HolidayComponent reload={reloadTrigger} />
                )}
              </div>
            </div>
          </>
        )}


          {/* Policy Modal - Centered */}
          <Modal 
            isOpen={showPolicyModal} 
            onClose={() => setShowPolicyModal(false)}
            title="Add SLA Policy"
            size="lg"
          >
            <PolicyForm onSucess={() => { setReloadTrigger(prev => prev + 1); setShowPolicyModal(false); }} />
          </Modal>

          {/* Business Hours Modal - Centered */}
          <Modal 
            isOpen={showBusinessHoursModal} 
            onClose={() => setShowBusinessHoursModal(false)}
            title="Add Schedule"
            size="lg"
          >
            <BusinessHoursForm onSucess={() => { setReloadTrigger(prev => prev + 1); setShowBusinessHoursModal(false); }} />
          </Modal>

          {/* Holiday Modal - Centered */}
          <Modal 
            isOpen={showHolidayModal} 
            onClose={() => setShowHolidayModal(false)}
            title="Create Holiday"
            size="md"
          >
            <HolidayForm onSucess={() => { setReloadTrigger(prev => prev + 1); setShowHolidayModal(false); }} />
          </Modal>

          {/* Info Modal - Centered */}
          <Modal
            isOpen={infoModalOpen}
            onClose={() => setInfoModalOpen(false)}
            title="About SLA Policies"
            size="lg"
          >
            <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What are SLA Policies?</h4>
                <p>
                  Service Level Agreement (SLA) policies define the time targets for responding to and resolving customer tickets based on their priority level.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Priority Levels</h4>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>P1 (Critical):</strong> Highest priority - urgent issues requiring immediate attention</li>
                  <li><strong>P2 (High):</strong> Important issues that need quick resolution</li>
                  <li><strong>P3 (Normal):</strong> Standard priority for regular support requests</li>
                  <li><strong>P4 (Low):</strong> Lower priority items that can be addressed with more flexibility</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">How It Works</h4>
                <p>
                  When a ticket is created, the system automatically assigns an SLA target based on the ticket's priority. 
                  The countdown begins from ticket creation and calculates the due time based on your configured business hours.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Time Calculation</h4>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>SLA time only counts during your defined business hours (default: 8 AM – 5 PM, Mon–Fri)</li>
                  <li>Non-working hours, weekends, and holidays are excluded from the countdown</li>
                  <li>You can customize business hours and holiday settings in their respective tabs</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs">
                  <strong>Tip:</strong> Use the toggle switches at the top of the page to enable/disable SLA tracking, 
                  holiday inclusion, and weekend hours to match your support team's availability.
                </p>
              </div>
            </div>
          </Modal>

        </div>
    </div>
  );
};

export default SlaPage;
