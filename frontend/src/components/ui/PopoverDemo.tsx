import React, { useState } from 'react';
import Popover from './Tip';

// Sample form component to demonstrate complex content
const ContactForm: React.FC<{ onSubmit: (data: any) => void; onCancel: () => void }> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ name: '', email: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="w-80">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Us</h3>
      
      <div className="mb-4">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          required
        />
      </div>

      <div className="flex space-x-2">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Send Message
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// Sample settings component
const SettingsPanel: React.FC<{ onSave: (settings: any) => void }> = ({ onSave }) => {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoSave: true
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <div className="w-64">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Settings</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Notifications</span>
          <button
            onClick={() => handleToggle('notifications')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.notifications ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Dark Mode</span>
          <button
            onClick={() => handleToggle('darkMode')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.darkMode ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.darkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Auto Save</span>
          <button
            onClick={() => handleToggle('autoSave')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoSave ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.autoSave ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleSave}
          className="w-full px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

// Sample user profile component
const UserProfile: React.FC = () => {
  return (
    <div className="w-72">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
          <span className="text-white font-semibold text-lg">JD</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">John Doe</h3>
          <p className="text-sm text-gray-500">john.doe@example.com</p>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-4">
        <div className="space-y-2">
          <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            View Profile
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            Account Settings
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            Help & Support
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

// Demo component to showcase the popover with various components
const PopoverDemo: React.FC = () => {
  const handleFormSubmit = (data: any) => {
    alert(`Form submitted with data: ${JSON.stringify(data)}`);
  };

  const handleSettingsSave = (settings: any) => {
    alert(`Settings saved: ${JSON.stringify(settings)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-12">
          React TypeScript Popover Component Demo
        </h1>

        {/* Basic Examples */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="flex justify-center">
            <Popover
              trigger={
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Bottom Popover
                </button>
              }
              content={
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Bottom Popover</h3>
                  <p className="text-gray-600 text-sm">
                    This popover appears below the trigger button.
                  </p>
                </div>
              }
              position="bottom"
            />
          </div>

          <div className="flex justify-center">
            <Popover
              trigger={
                <button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
                  Top Popover
                </button>
              }
              content={
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Top Popover</h3>
                  <p className="text-gray-600 text-sm">
                    This popover appears above the trigger button.
                  </p>
                </div>
              }
              position="top"
            />
          </div>

          <div className="flex justify-center">
            <Popover
              trigger={
                <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                  Left Popover
                </button>
              }
              content={
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Left Popover</h3>
                  <p className="text-gray-600 text-sm">
                    This popover appears to the left of the trigger.
                  </p>
                </div>
              }
              position="left"
            />
          </div>

          <div className="flex justify-center">
            <Popover
              trigger={
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                  Right Popover
                </button>
              }
              content={
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Right Popover</h3>
                  <p className="text-gray-600 text-sm">
                    This popover appears to the right of the trigger.
                  </p>
                </div>
              }
              position="right"
            />
          </div>
        </div>

        {/* Complex Component Examples */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">
            Complex Components in Popovers
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Contact Form Popover */}
            <div className="flex justify-center">
              <Popover
                trigger={
                  <button className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Contact Form</span>
                  </button>
                }
                content={
                  <ContactForm 
                    onSubmit={handleFormSubmit}
                    onCancel={() => {}} 
                  />
                }
                position="bottom"
                contentClassName="p-0 border-gray-300"
              />
            </div>

            {/* Settings Panel Popover */}
            <div className="flex justify-center">
              <Popover
                trigger={
                  <button className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings</span>
                  </button>
                }
                content={<SettingsPanel onSave={handleSettingsSave} />}
                position="bottom"
                contentClassName="p-0 border-gray-300"
              />
            </div>

            {/* User Profile Popover */}
            <div className="flex justify-center">
              <Popover
                trigger={
                  <div className="flex items-center space-x-2 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-all cursor-pointer">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">JD</span>
                    </div>
                    <span className="text-gray-700">John Doe</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                }
                content={<UserProfile />}
                position="bottom"
                contentClassName="p-0 border-gray-300"
              />
            </div>

            {/* Custom Component with State */}
            <div className="flex justify-center">
              <Popover
                trigger={
                  <button className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Counter App</span>
                  </button>
                }
                content={
                  (() => {
                    const CounterComponent = () => {
                      const [count, setCount] = useState(0);
                      return (
                        <div className="w-48 text-center">
                          <h3 className="text-lg font-semibold text-gray-800 mb-4">Counter</h3>
                          <div className="text-3xl font-bold text-blue-500 mb-4">{count}</div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setCount(count - 1)}
                              className="flex-1 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => setCount(0)}
                              className="flex-1 px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                            >
                              Reset
                            </button>
                            <button
                              onClick={() => setCount(count + 1)}
                              className="flex-1 px-3 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                            >
                              +1
                            </button>
                          </div>
                        </div>
                      );
                    };
                    return <CounterComponent />;
                  })()
                }
                position="bottom"
              />
            </div>
          </div>
        </div>

        {/* Test Boundary Cases */}
        <div className="bg-white rounded-xl shadow-lg p-8 mt-16">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">
            Test Viewport Boundary Detection
          </h2>
          
          <div className="space-y-8">
            {/* Top boundary test */}
            <div className="flex justify-center">
              <Popover
                trigger={
                  <button className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                    Near Top (should flip to bottom)
                  </button>
                }
                content={
                  <div className="w-64">
                    <h3 className="font-semibold text-gray-800 mb-2">Auto-positioned Popover</h3>
                    <p className="text-gray-600 text-sm">
                      This popover was requested to show on top, but automatically flipped to bottom because it would be clipped by the viewport.
                    </p>
                  </div>
                }
                position="top"
              />
            </div>

            {/* Add some spacing to push the bottom test down */}
            <div style={{ height: '60vh' }}></div>

            {/* Bottom boundary test */}
            <div className="flex justify-center">
              <Popover
                trigger={
                  <button className="px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
                    Near Bottom (should flip to top)
                  </button>
                }
                content={
                  <div className="w-64">
                    <h3 className="font-semibold text-gray-800 mb-2">Auto-positioned Popover</h3>
                    <p className="text-gray-600 text-sm">
                      This popover was requested to show on bottom, but automatically flipped to top because it would be clipped by the viewport bottom.
                    </p>
                  </div>
                }
                position="bottom"
              />
            </div>

            <div style={{ height: '10vh' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopoverDemo;
