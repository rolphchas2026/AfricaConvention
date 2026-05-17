import React, { useState, useEffect } from 'react';
import { Download, Printer, Users, Check, AlertCircle, RefreshCw } from 'lucide-react';

export default function BadgeGenerator() {
  const [attendees, setAttendees] = useState([]);
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [badgeFormat, setBadgeFormat] = useState('pdf'); // 'pdf' or 'printable'
  const [badgeTemplate, setBadgeTemplate] = useState('standard');
  const [generatingBadges, setGeneratingBadges] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedCount, setGeneratedCount] = useState(0);
  const [filterCategory, setFilterCategory] = useState('all');

  // Fetch attendees from database
  useEffect(() => {
    fetchAttendees();
  }, [filterCategory]);

  const fetchAttendees = async () => {
    try {
      setIsLoading(true);
      const url = filterCategory === 'all' 
        ? 'http://localhost:3000/api/attendees'
        : `http://localhost:3000/api/attendees?category=${filterCategory}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setAttendees(data.attendees || []);
      setSelectedAttendees([]);
    } catch (error) {
      console.error('Error fetching attendees:', error);
      setErrorMessage('Failed to load attendees');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAttendeeSelection = (attendeeId) => {
    setSelectedAttendees(prev =>
      prev.includes(attendeeId)
        ? prev.filter(id => id !== attendeeId)
        : [...prev, attendeeId]
    );
  };

  const selectAll = () => {
    setSelectedAttendees(attendees.map(a => a.id));
  };

  const deselectAll = () => {
    setSelectedAttendees([]);
  };

  // Generate and download badges
  const generateBadges = async () => {
    if (selectedAttendees.length === 0) {
      setErrorMessage('Please select at least one attendee');
      return;
    }

    setGeneratingBadges(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const selectedData = attendees.filter(a => selectedAttendees.includes(a.id));

      const response = await fetch('http://localhost:3000/api/badges/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendees: selectedData,
          format: badgeFormat,
          template: badgeTemplate,
          event_name: '2026 Africa Convention',
          event_date: '18-22 June 2026',
            event_venue: 'Arusha, Tanzania'
        })
      });

      if (!response.ok) throw new Error('Badge generation failed');

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `badges-${new Date().toISOString().split('T')[0]}.${badgeFormat === 'pdf' ? 'pdf' : 'html'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage(`✅ Generated ${selectedAttendees.length} badges successfully!`);
      setGeneratedCount(prev => prev + selectedAttendees.length);
      setSelectedAttendees([]);

    } catch (error) {
      console.error('Error generating badges:', error);
      setErrorMessage('Failed to generate badges');
    } finally {
      setGeneratingBadges(false);
    }
  };

  const BadgePreview = ({ attendee }) => (
    <div className="w-80 bg-gradient-to-br from-blue-50 to-blue-100 border-4 border-blue-600 rounded-lg p-6 shadow-lg font-sans" style={{ aspectRatio: '3.5/2.2' }}>
      {/* Header */}
      <div className="text-center mb-2">
        <div className="text-xs font-bold text-blue-900 tracking-widest">2026 AFRICA CONVENTION</div>
        <div className="text-xs text-blue-700">18-22 June 2026 • Arusha, Tanzania</div>
      </div>

      {/* Badge Content */}
      <div className="flex items-center justify-between h-full">
        {/* Left Side - QR Code */}
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 bg-white border-2 border-blue-900 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xs font-bold text-blue-900">QR Code</div>
              <div className="w-24 h-24 bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                [{attendee.id}]
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Attendee Info */}
        <div className="flex-1 pl-4">
          <div className="mb-2">
            <div className="text-2xl font-bold text-blue-900 leading-tight">{attendee.name}</div>
            <div className="text-sm font-semibold text-blue-700 mt-1">{attendee.category}</div>
          </div>
          <div className="text-xs text-gray-700 space-y-1">
            <div><strong>Email:</strong> {attendee.email}</div>
            <div><strong>Phone:</strong> {attendee.phone || 'N/A'}</div>
            <div className="mt-3 pt-3 border-t border-blue-300">
              <div className="text-xs font-bold text-blue-900">Event Entry: Valid</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading attendees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" /> ID Badge Generator
        </h2>
        <p className="text-blue-100 mt-2">Create professional ID badges for attendees</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded flex gap-3 items-start">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        {/* Badge Format Selection */}
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Badge Format</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setBadgeFormat('pdf')}
              className={`p-4 rounded-lg border-2 transition ${
                badgeFormat === 'pdf'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-400'
              }`}
            >
              <Download className="w-6 h-6 mx-auto mb-2" />
              <div className="font-semibold text-sm">PDF Download</div>
              <div className="text-xs text-gray-600">Email to attendees</div>
            </button>
            <button
              onClick={() => setBadgeFormat('printable')}
              className={`p-4 rounded-lg border-2 transition ${
                badgeFormat === 'printable'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-400'
              }`}
            >
              <Printer className="w-6 h-6 mx-auto mb-2" />
              <div className="font-semibold text-sm">Print Ready</div>
              <div className="text-xs text-gray-600">Physical cards</div>
            </button>
          </div>
        </div>

        {/* Badge Template Selection */}
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Badge Template</h3>
          <div className="space-y-2">
            <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 cursor-pointer">
              <input
                type="radio"
                name="template"
                value="standard"
                checked={badgeTemplate === 'standard'}
                onChange={(e) => setBadgeTemplate(e.target.value)}
                className="w-4 h-4"
              />
              <span className="ml-3">
                <span className="font-semibold text-gray-900">Standard</span>
                <div className="text-sm text-gray-600">Name, Title, QR Code, Info</div>
              </span>
            </label>
            <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 cursor-pointer">
              <input
                type="radio"
                name="template"
                value="minimal"
                checked={badgeTemplate === 'minimal'}
                onChange={(e) => setBadgeTemplate(e.target.value)}
                className="w-4 h-4"
              />
              <span className="ml-3">
                <span className="font-semibold text-gray-900">Minimal</span>
                <div className="text-sm text-gray-600">Name, Title, QR Code only</div>
              </span>
            </label>
          </div>
        </div>

        {/* Filter by Category */}
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Filter by Category</h3>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full p-2 border-2 border-gray-200 rounded-lg focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Categories ({attendees.length})</option>
            <option value="Speaker">Speakers</option>
            <option value="Youth">Youth Participants</option>
            <option value="Business">Business Representatives</option>
            <option value="Leader">Community Leaders</option>
            <option value="Organizer">Organizers</option>
            <option value="Media">Media/Observers</option>
          </select>
        </div>
      </div>

      {/* Attendees Selection */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-lg">
            Select Attendees ({selectedAttendees.length}/{attendees.length})
          </h3>
          <div className="space-x-2">
            <button
              onClick={selectAll}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-semibold"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-semibold"
            >
              Clear
            </button>
          </div>
        </div>

        {attendees.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No attendees found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {attendees.map(attendee => (
              <div
                key={attendee.id}
                onClick={() => toggleAttendeeSelection(attendee.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                  selectedAttendees.includes(attendee.id)
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAttendees.includes(attendee.id)}
                    onChange={() => toggleAttendeeSelection(attendee.id)}
                    className="w-5 h-5 mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{attendee.name}</p>
                    <p className="text-sm text-gray-600">{attendee.category}</p>
                    <p className="text-xs text-gray-500">{attendee.email}</p>
                  </div>
                  {selectedAttendees.includes(attendee.id) && (
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Badge Preview */}
      {selectedAttendees.length > 0 && attendees.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Badge Preview</h3>
          <div className="flex justify-center overflow-x-auto pb-4">
            <BadgePreview attendee={attendees.find(a => a.id === selectedAttendees[0])} />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="bg-white rounded-lg shadow-lg p-6 sticky bottom-0">
        <button
          onClick={generateBadges}
          disabled={selectedAttendees.length === 0 || generatingBadges}
          className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition flex items-center justify-center gap-2 ${
            selectedAttendees.length === 0 || generatingBadges
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {generatingBadges ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Generating {selectedAttendees.length} Badges...
            </>
          ) : (
            <>
              {badgeFormat === 'pdf' ? (
                <Download className="w-5 h-5" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              Generate {selectedAttendees.length} Badge{selectedAttendees.length !== 1 ? 's' : ''} ({badgeFormat.toUpperCase()})
            </>
          )}
        </button>
        {generatedCount > 0 && (
          <p className="text-center text-sm text-green-600 mt-3">
            ✅ Total badges generated: {generatedCount}
          </p>
        )}
      </div>
    </div>
  );
}
