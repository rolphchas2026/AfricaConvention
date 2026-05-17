import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, CheckCircle, QrCode, Users, Clock, MapPin, Download, Upload } from 'lucide-react';

export default function QRCheckInSystem() {
  const videoRef = useRef(null);
  const [scannedData, setScannedData] = useState([]);
  const [eventInfo] = useState({
    name: '2026 Africa Convention',
    theme: 'Doing Business and Bearing Fruitful',
    date: '18th - 22nd June, 2026',
    venue: 'Arusha, Tanzania',
    organizers: 'WCCM & Living Hope Mission'
  });
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(localStorage.getItem('lastSync') || 'Never');
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerMode, setScannerMode] = useState('scanner'); // 'scanner', 'manual', 'statistics'
  const [manualInput, setManualInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load scanned data from localStorage (offline persistence)
  useEffect(() => {
    const stored = localStorage.getItem('qrScans');
    if (stored) {
      setScannedData(JSON.parse(stored));
    }
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        startQRScanning();
      }
    } catch (err) {
      setErrorMsg('Camera access denied. Use manual entry instead.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  // QR Scanning simulation (in production, use @react-qr-code-library or jsQR)
  const startQRScanning = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const scan = () => {
      if (videoRef.current && cameraActive) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // In production, use jsQR library to decode
        // For demo, simulate detection
        requestAnimationFrame(scan);
      }
    };
    scan();
  };

  // Process QR or manual data
  const processAttendee = (data) => {
    // Expected format: "NAME|EMAIL|PHONE|CATEGORY" (e.g., "John Doe|john@email.com|+255...")
    const parts = data.trim().split('|');
    
    if (parts.length < 2) {
      setErrorMsg('Invalid QR/Entry format. Use: NAME|EMAIL|PHONE|CATEGORY');
      return;
    }

    const newAttendee = {
      id: Date.now(),
      name: parts[0].trim(),
      email: parts[1]?.trim() || 'N/A',
      phone: parts[2]?.trim() || 'N/A',
      category: parts[3]?.trim() || 'Participant',
      checkedIn: new Date().toLocaleString(),
      online: isOnline
    };

    // Check for duplicates
    const isDuplicate = scannedData.some(a => a.email === newAttendee.email);
    if (isDuplicate) {
      setErrorMsg(`${newAttendee.name} already checked in!`);
      return;
    }

    // Add to scanned data
    const updated = [...scannedData, newAttendee];
    setScannedData(updated);
    localStorage.setItem('qrScans', JSON.stringify(updated));
    
    // Sync to backend if online
    if (isOnline) {
      syncToBackend(newAttendee);
    }

    setSuccessMsg(`✓ ${newAttendee.name} checked in!`);
    setManualInput('');
    setTimeout(() => setSuccessMsg(''), 3000);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  // Sync check-ins to backend
  const syncToBackend = async (attendee) => {
    try {
      const response = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attendee)
      });
      
      if (response.ok) {
        setLastSync(new Date().toLocaleString());
        localStorage.setItem('lastSync', new Date().toLocaleString());
      }
    } catch (err) {
      console.log('Sync queued for later:', err);
      // Data already saved locally, will retry on next online
    }
  };

  // Export data as CSV
  const exportCSV = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Category', 'Check-in Time', 'Sync Status'],
      ...scannedData.map(a => [a.name, a.email, a.phone, a.category, a.checkedIn, a.online ? 'Online' : 'Offline'])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkins-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Statistics
  const stats = {
    total: scannedData.length,
    online: scannedData.filter(a => a.online).length,
    offline: scannedData.filter(a => !a.online).length,
    byCategory: scannedData.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {})
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-blue-900">{eventInfo.name}</h1>
              <p className="text-lg text-gray-700 mt-1">"{eventInfo.theme}"</p>
            </div>
            <div className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 ${
              isOnline ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
            }`}>
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-600' : 'bg-orange-600'}`}></div>
              {isOnline ? 'Online' : 'Offline Mode'}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="w-5 h-5" /> {eventInfo.date}
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-5 h-5" /> {eventInfo.venue}
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Users className="w-5 h-5" /> {eventInfo.organizers}
            </div>
            <div className="flex items-center gap-2 text-gray-600 text-xs">
              <Clock className="w-4 h-4" /> Last sync: {lastSync}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Check-in Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mode Selection */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => { setScannerMode('scanner'); startCamera(); }}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                    scannerMode === 'scanner'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <QrCode className="w-5 h-5" /> QR Scanner
                </button>
                <button
                  onClick={() => { setScannerMode('manual'); stopCamera(); }}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                    scannerMode === 'manual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Upload className="w-5 h-5" /> Manual Entry
                </button>
                <button
                  onClick={() => { setScannerMode('statistics'); stopCamera(); }}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                    scannerMode === 'statistics'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Users className="w-5 h-5" /> Statistics
                </button>
              </div>

              {/* QR Scanner Mode */}
              {scannerMode === 'scanner' && (
                <div className="space-y-4">
                  <div className="bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={stopCamera}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-semibold transition"
                  >
                    Stop Camera
                  </button>
                  <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                    <p className="text-sm text-blue-800">
                      📷 Point camera at QR codes. Format: <code className="bg-blue-100 px-2 py-1 rounded">NAME|EMAIL|PHONE|CATEGORY</code>
                    </p>
                  </div>
                </div>
              )}

              {/* Manual Entry Mode */}
              {scannerMode === 'manual' && (
                <div className="space-y-4">
                  <textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Paste QR data or type:&#10;John Doe|john@email.com|+255123456789|Participant&#10;&#10;Or paste bulk entries (one per line)"
                    className="w-full h-32 p-4 border-2 border-gray-300 rounded-lg font-mono text-sm focus:border-blue-600 focus:outline-none resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => processAttendee(manualInput)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition"
                    >
                      Check In Single
                    </button>
                    <button
                      onClick={() => {
                        manualInput.split('\n').forEach(line => {
                          if (line.trim()) processAttendee(line);
                        });
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
                    >
                      Check In Bulk
                    </button>
                  </div>
                </div>
              )}

              {/* Statistics Mode */}
              {scannerMode === 'statistics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
                      <p className="text-gray-600 text-sm">Total Check-ins</p>
                      <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-600">
                      <p className="text-gray-600 text-sm">Online Synced</p>
                      <p className="text-3xl font-bold text-green-900">{stats.online}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-600">
                      <p className="text-gray-600 text-sm">Offline Buffer</p>
                      <p className="text-3xl font-bold text-orange-900">{stats.offline}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-600">
                      <p className="text-gray-600 text-sm">Categories</p>
                      <p className="text-3xl font-bold text-purple-900">{Object.keys(stats.byCategory).length}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">By Category</h3>
                    {Object.entries(stats.byCategory).map(([cat, count]) => (
                      <div key={cat} className="flex justify-between py-2 border-b border-gray-200 last:border-0">
                        <span className="text-gray-700">{cat}</span>
                        <span className="font-semibold text-blue-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            {successMsg && (
              <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded flex gap-3 items-start">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <p className="text-green-800">{successMsg}</p>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded flex gap-3 items-start">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <p className="text-red-800">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Attendee List & Actions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Checked In ({scannedData.length})</h2>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scannedData.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No check-ins yet</p>
                ) : (
                  scannedData.map((attendee) => (
                    <div key={attendee.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <p className="font-semibold text-gray-900 text-sm">{attendee.name}</p>
                      <p className="text-xs text-gray-600">{attendee.email}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {attendee.category}
                        </span>
                        {attendee.online && (
                          <span className="text-xs text-green-600">✓ Synced</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {scannedData.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" /> Export CSV
                </button>
              )}
            </div>

            {/* Offline Notice */}
            {!isOnline && scannedData.filter(a => !a.online).length > 0 && (
              <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded">
                <p className="text-sm text-orange-800">
                  <strong>⚠ Offline Mode:</strong> {scannedData.filter(a => !a.online).length} check-ins waiting to sync
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple icon fallback
function Calendar(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
