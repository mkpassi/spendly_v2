import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { 
  User, 
  Camera, 
  Save, 
  Mail, 
  Calendar, 
  Shield, 
  Bell, 
  Smartphone,
  CreditCard,
  Download,
  Trash2,
  Edit3
} from 'lucide-react';

// Mock user data - in a real app this would come from authentication
const initialUserData = {
  id: 'user_123',
  name: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2',
  joinedDate: '2024-01-15',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  timezone: 'Pacific Time (PT)',
  currency: 'USD',
  language: 'English',
  notifications: {
    email: true,
    push: true,
    sms: false,
    goalReminders: true,
    monthlyReports: true
  },
  privacy: {
    profileVisible: true,
    dataSharing: false,
    analytics: true
  }
};

export const ProfilePage: React.FC = () => {
  const [userData, setUserData] = useState(initialUserData);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'privacy' | 'data'>('profile');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserData(prev => ({
          ...prev,
          avatar: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const TabButton: React.FC<{
    id: 'profile' | 'preferences' | 'privacy' | 'data';
    icon: React.ReactNode;
    label: string;
  }> = ({ id, icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        activeTab === id
          ? 'bg-blue-500 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <Layout 
      title="User Profile" 
      description="Manage your account settings and preferences"
    >
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-green-500 h-32"></div>
          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16">
              <div className="relative">
                <img
                  src={userData.avatar}
                  alt={userData.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
                {isEditing && (
                  <label className="absolute bottom-2 right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-colors">
                    <Camera className="h-5 w-5 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
              <div className="flex-1 sm:ml-4 mt-4 sm:mt-0">
                <h2 className="text-2xl font-bold text-slate-800">{userData.name}</h2>
                <p className="text-slate-600">{userData.email}</p>
                <p className="text-sm text-slate-500 mt-1">
                  Member since {new Date(userData.joinedDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </p>
              </div>
              
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <nav className="flex flex-wrap gap-2">
              <TabButton
                id="profile"
                icon={<User className="h-4 w-4" />}
                label="Profile Info"
              />
              <TabButton
                id="preferences"
                icon={<Bell className="h-4 w-4" />}
                label="Preferences"
              />
              <TabButton
                id="privacy"
                icon={<Shield className="h-4 w-4" />}
                label="Privacy"
              />
              <TabButton
                id="data"
                icon={<Download className="h-4 w-4" />}
                label="Data & Export"
              />
            </nav>
          </div>

          <div className="p-6">
            {/* Profile Info Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={userData.name}
                      onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={userData.email}
                        disabled
                        className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                      />
                      <Mail className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={userData.phone}
                      onChange={(e) => setUserData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={userData.location}
                      onChange={(e) => setUserData(prev => ({ ...prev, location: e.target.value }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Timezone
                    </label>
                    <select
                      value={userData.timezone}
                      onChange={(e) => setUserData(prev => ({ ...prev, timezone: e.target.value }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="Pacific Time (PT)">Pacific Time (PT)</option>
                      <option value="Mountain Time (MT)">Mountain Time (MT)</option>
                      <option value="Central Time (CT)">Central Time (CT)</option>
                      <option value="Eastern Time (ET)">Eastern Time (ET)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Currency
                    </label>
                    <select
                      value={userData.currency}
                      onChange={(e) => setUserData(prev => ({ ...prev, currency: e.target.value }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Notification Preferences</h3>
                  <div className="space-y-4">
                    {Object.entries({
                      email: 'Email Notifications',
                      push: 'Push Notifications',
                      sms: 'SMS Notifications',
                      goalReminders: 'Goal Reminders',
                      monthlyReports: 'Monthly Reports'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-slate-700">{label}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userData.notifications[key as keyof typeof userData.notifications]}
                            onChange={(e) => setUserData(prev => ({
                              ...prev,
                              notifications: {
                                ...prev.notifications,
                                [key]: e.target.checked
                              }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Privacy Settings</h3>
                  <div className="space-y-4">
                    {Object.entries({
                      profileVisible: 'Make profile visible to other users',
                      dataSharing: 'Share anonymized data for research',
                      analytics: 'Allow analytics and performance tracking'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-slate-700">{label}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userData.privacy[key as keyof typeof userData.privacy]}
                            onChange={(e) => setUserData(prev => ({
                              ...prev,
                              privacy: {
                                ...prev.privacy,
                                [key]: e.target.checked
                              }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Data & Export Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Data Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Download className="h-6 w-6 text-blue-600" />
                        <h4 className="font-semibold text-blue-900">Export Data</h4>
                      </div>
                      <p className="text-sm text-blue-800 mb-4">
                        Download all your financial data in CSV format
                      </p>
                      <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                        Download Data
                      </button>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Trash2 className="h-6 w-6 text-red-600" />
                        <h4 className="font-semibold text-red-900">Delete Account</h4>
                      </div>
                      <p className="text-sm text-red-800 mb-4">
                        Permanently delete your account and all data
                      </p>
                      <button className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-2">Data Retention Policy</h4>
                  <p className="text-sm text-amber-800">
                    Your financial data is stored securely and retained for as long as your account is active. 
                    You can request data deletion at any time. Anonymized analytics data may be retained 
                    for up to 2 years for service improvement purposes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};