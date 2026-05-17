import React, { useState } from 'react';
import { BarChart3, Users, CheckCircle, TrendingUp, QrCode, AlertCircle, Ticket } from 'lucide-react';
import BadgeGenerator from './badge-generator';

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition ${
        activeTab === id
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-6 px-6">
        <h1 className="text-3xl font-bold">🎯 Event Management Suite</h1>
        <p className="text-blue-100 mt-2">2026 Africa Convention - Complete Control</p>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-3 mb-8">
          <TabButton id="overview" label="Live Dashboard" icon={BarChart3} />
          <TabButton id="badges" label="ID Badge Generator" icon={Ticket} />
          <TabButton id="checkins" label="Check-ins" icon={CheckCircle} />
          <TabButton id="statistics" label="Statistics" icon={TrendingUp} />
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <LiveDashboard />
            </div>
          )}

          {/* Badge Generator Tab */}
          {activeTab === 'badges' && (
            <BadgeGenerator />
          )}

          {/* Check-ins Tab */}
          {activeTab === 'checkins' && (
            <CheckInsView />
          )}

          {/* Statistics Tab */}
          {activeTab === 'statistics' && (
            <StatisticsView />
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== LIVE DASHBOARD COMPONENT ====================

function LiveDashboard() {
  const [stats, setStats] = React.useState({
    total_registered: 0,
    total_checked_in: 0,
    total_verified: 0,
    check_in_rate: 0
  });
  const [timeline, setTimeline] = React.useState([]);
  const [recentScans, setRecentScans] = React.useState([]);
  const [byCategory, setByCategory] = React.useState([]);
  const [lastUpdate, setLastUpdate] = React.useState(new Date());

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('http://localhost:3000/api/statistics');
        const statsData = await statsRes.json();
        setStats(statsData.summary);
        setRecentScans(statsData.recent_checkins || []);
        setByCategory(statsData.by_category || []);

        const dashRes = await fetch('http://localhost:3000/api/dashboard');
        const dashData = await dashRes.json();
        setTimeline(dashData.timeline || []);

        setLastUpdate(new Date());
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className={`bg-gradient-to-br ${color} p-6 rounded-lg shadow-lg text-white`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-semibold opacity-90">{title}</p>
          <p className="text-4xl font-bold mt-2">{value}</p>
        </div>
        <Icon className="w-8 h-8 opacity-60" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Registered"
          value={stats.total_registered || 0}
          icon={Users}
          color="from-purple-500 to-purple-700"
        />
        <StatCard
          title="Checked In"
          value={stats.total_checked_in || 0}
          icon={CheckCircle}
          color="from-green-500 to-green-700"
        />
        <StatCard
          title="Check-in Rate"
          value={`${stats.check_in_rate || 0}%`}
          icon={TrendingUp}
          color="from-blue-500 to-blue-700"
        />
        <StatCard
          title="Verified"
          value={stats.total_verified || 0}
          icon={QrCode}
          color="from-orange-500 to-orange-700"
        />
      </div>

      {/* Attendance by Category */}
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Attendance by Category</h2>
        <div className="space-y-4">
          {byCategory.map((cat, i) => {
            const checkedInPercent = cat.registered > 0 ? (cat.checked_in / cat.registered * 100) : 0;
            return (
              <div key={i} className="border-b pb-4 last:border-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-900">{cat.category}</span>
                  <span className="text-sm text-gray-600">{cat.checked_in}/{cat.registered}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{ width: `${checkedInPercent}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Check-ins */}
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Check-ins</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentScans.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Waiting for first check-in...</p>
          ) : (
            recentScans.map((scan, i) => (
              <div key={i} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{scan.name}</p>
                    <p className="text-xs text-gray-600">{scan.category}</p>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(scan.check_in_time).toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-blue-100 text-sm text-center">
        Last updated: {lastUpdate.toLocaleTimeString()}
      </p>
    </div>
  );
}

// ==================== CHECK-INS VIEW COMPONENT ====================

function CheckInsView() {
  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Check-in Management</h2>
      <p className="text-gray-600">Use the QR scanner at the main entrance (http://localhost:3000)</p>
      <p className="text-gray-600 mt-2">All scans are recorded and appear in the Live Dashboard in real-time.</p>
    </div>
  );
}

// ==================== STATISTICS VIEW COMPONENT ====================

function StatisticsView() {
  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Event Statistics</h2>
      <p className="text-gray-600">Detailed analytics and reporting features coming soon.</p>
    </div>
  );
}
