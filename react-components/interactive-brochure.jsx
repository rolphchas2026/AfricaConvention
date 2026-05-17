import React, { useState } from 'react';
import { MapPin, Calendar, Users, Phone, Mail, ExternalLink, Download, QrCode, ChevronRight, Globe } from 'lucide-react';

export default function EventBrochure() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showQRGuide, setShowQRGuide] = useState(false);

  const eventData = {
    name: '2026 Africa Convention',
    theme: 'Doing Business and Bearing Fruitful',
    subtitle: 'Youth Summit',
    dates: '18th - 22nd June, 2026',
    venue: 'Arusha, Tanzania',
    venues_details: 'Living Hope Mission Center - Modern Church Facility',
    estimatedAttendees: '400-600',
    organizers: ['WCCM (World Class Cities Ministries)', 'Living Hope Mission', 'YWAM (Youth With A Mission)'],
    contacts: {
      whatsapp: ['+255 787 576 900', '+255 713 276 655', '+255 767 576 900 (Alt)', '+234 805 622 262 (Nigeria)'],
      email: 'wccm.tz@gmail.com',
      website: 'www.livinghope.or.tz'
    },
    keynoteSpeakers: [
      { name: 'Minister Dr.', title: 'Church Leader', region: 'Regional' },
      { name: 'Bishop Dr. Gilbert', title: 'Senior Bishop', region: 'International' },
      { name: 'Chief David John Mackenzie', title: 'Chief Speaker', region: 'International' },
      { name: 'Apostle Dr. George M. Watts', title: 'Apostle', region: 'International' },
      { name: 'Various Pastors & Church Leaders', title: 'Ministers', region: 'Tanzania' }
    ],
    categories: [
      'Youth Participants',
      'Speakers/Ministers',
      'Business Representatives',
      'Community Leaders',
      'Church Staff',
      'Media/Observers'
    ],
    themePoints: [
      'Youth Entrepreneurship in African Markets',
      'Business Ethics & Christian Values',
      'Economic Cooperation (Tanzania & USA)',
      'Sustainable Community Enterprises',
      'Spiritual Purpose & Commercial Success'
    ]
  };

  const BrochureTab = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
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
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 to-blue-700 text-white py-16 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute w-96 h-96 bg-white rounded-full -top-48 -right-48"></div>
          <div className="absolute w-80 h-80 bg-blue-500 rounded-full -bottom-40 -left-40"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="mb-4 inline-block bg-orange-500 text-white px-4 py-2 rounded-full font-semibold">
            🎟️ OFFICIAL EVENT BROCHURE
          </div>

          <h1 className="text-5xl font-bold mb-2">{eventData.name}</h1>
          <p className="text-2xl text-blue-100 mb-4">"{eventData.theme}"</p>
          <p className="text-lg text-blue-100 flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            {eventData.dates} • {eventData.venue}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <BrochureTab id="overview" label="Overview" icon={Globe} />
          <BrochureTab id="details" label="Details" icon={MapPin} />
          <BrochureTab id="speakers" label="Speakers" icon={Users} />
          <BrochureTab id="contact" label="Contact" icon={Phone} />
          <BrochureTab id="qrguide" label="QR Guide" icon={QrCode} />
        </div>

        {/* Content Sections */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-blue-900 mb-4">Event Overview</h2>
                <p className="text-lg text-gray-700 mb-6">
                  Join us for the 2026 Africa Convention, a transformative youth summit bringing together leaders, 
                  entrepreneurs, and innovators from across Africa and beyond. This five-day event focuses on the 
                  integration of business success with spiritual purpose and community impact.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-600">
                  <h3 className="font-bold text-blue-900 text-xl mb-3">🎯 Theme Focus</h3>
                  <p className="text-gray-700">
                    "{eventData.theme}" - Combining commercial success with ministry impact and community 
                    transformation through youth entrepreneurship and business excellence.
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-600">
                  <h3 className="font-bold text-green-900 text-xl mb-3">👥 Expected Audience</h3>
                  <p className="text-gray-700">
                    <strong>{eventData.estimatedAttendees}</strong> attendees including youth, speakers, 
                    international leaders, business professionals, and community representatives.
                  </p>
                </div>
              </div>

              <div className="bg-orange-50 p-6 rounded-lg border-l-4 border-orange-600">
                <h3 className="font-bold text-orange-900 text-xl mb-4">🏢 Organizing Bodies</h3>
                <ul className="space-y-2">
                  {eventData.organizers.map((org, i) => (
                    <li key={i} className="text-gray-700 flex items-start gap-2">
                      <ChevronRight className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>{org}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-blue-900 mb-6">Event Details</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-4">📅 When</h3>
                  <div className="space-y-3 text-gray-700">
                    <p><strong>Dates:</strong> {eventData.dates}</p>
                    <p><strong>Duration:</strong> 5 days</p>
                    <p><strong>Check-in:</strong> Thursday, 18 June (morning)</p>
                    <p><strong>Closing:</strong> Saturday, 22 June (evening)</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-4">📍 Where</h3>
                  <div className="space-y-3 text-gray-700">
                    <p><strong>City:</strong> Arusha, Tanzania</p>
                    <p><strong>Facility:</strong> Living Hope Mission Center</p>
                    <p><strong>Capacity:</strong> 500+ attendees</p>
                    <p><strong>Parking:</strong> Available on-site</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-600">
                <h3 className="font-bold text-purple-900 text-lg mb-4">📋 Attendee Categories</h3>
                <div className="grid grid-cols-2 gap-3">
                  {eventData.categories.map((cat, i) => (
                    <div key={i} className="bg-white p-3 rounded-lg border border-purple-200 text-sm text-gray-700">
                      ✓ {cat}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-600">
                <h3 className="font-bold text-blue-900 text-lg mb-4">🎯 Theme Points</h3>
                <ul className="space-y-2">
                  {eventData.themePoints.map((point, i) => (
                    <li key={i} className="text-gray-700 flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">→</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* SPEAKERS */}
          {activeTab === 'speakers' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-blue-900 mb-6">Keynote Speakers</h2>
                <p className="text-gray-700 mb-6">
                  Featuring renowned spiritual leaders, business experts, and community advocates:
                </p>
              </div>

              <div className="grid gap-4">
                {eventData.keynoteSpeakers.map((speaker, i) => (
                  <div key={i} className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-blue-900">{speaker.name}</h3>
                        <p className="text-blue-700 font-semibold text-sm">{speaker.title}</p>
                      </div>
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        {speaker.region}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <p className="text-gray-700 text-center">
                  📧 Additional speaker biographies and schedules available at{' '}
                  <strong>www.livinghope.or.tz</strong>
                </p>
              </div>
            </div>
          )}

          {/* CONTACT */}
          {activeTab === 'contact' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-blue-900 mb-6">Contact Information</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-600">
                  <h3 className="font-bold text-green-900 text-lg mb-4 flex items-center gap-2">
                    <Phone className="w-6 h-6" /> WhatsApp
                  </h3>
                  <ul className="space-y-2">
                    {eventData.contacts.whatsapp.map((num, i) => (
                      <li key={i} className="text-gray-700 font-mono text-sm">
                        <a href={`https://wa.me/${num.replace(/\D/g, '')}`} className="text-green-600 hover:underline">
                          {num}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-600 mt-4">
                    💬 Quick responses via WhatsApp - all channels monitored daily
                  </p>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-600">
                  <h3 className="font-bold text-blue-900 text-lg mb-4 flex items-center gap-2">
                    <Mail className="w-6 h-6" /> Email & Web
                  </h3>
                  <div className="space-y-3 text-gray-700">
                    <p>
                      <strong>Email:</strong><br />
                      <a href={`mailto:${eventData.contacts.email}`} className="text-blue-600 hover:underline">
                        {eventData.contacts.email}
                      </a>
                    </p>
                    <p>
                      <strong>Website:</strong><br />
                      <a href={`https://${eventData.contacts.website}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        {eventData.contacts.website}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 p-6 rounded-lg border-l-4 border-orange-600">
                <h3 className="font-bold text-orange-900 text-lg mb-3">✉️ How to Register</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>✓ Send WhatsApp message to any number above</li>
                  <li>✓ Email inquiry to wccm.tz@gmail.com</li>
                  <li>✓ Visit www.livinghope.or.tz for online registration</li>
                  <li>✓ Mention your category (Youth, Speaker, Business, etc.)</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-600">
                <h3 className="font-bold text-purple-900 text-lg mb-3">📍 Getting to Arusha</h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>✈️ <strong>Arusha Airport (ARK)</strong> - Direct flights available</li>
                  <li>✈️ <strong>Kilimanjaro Intl (JRO)</strong> - 50km away, major hub</li>
                  <li>🚗 <strong>Road Access</strong> - Main highways from Dar es Salaam & Moshi</li>
                  <li>🏨 <strong>Accommodation</strong> - Various hotels in Arusha nearby</li>
                </ul>
              </div>
            </div>
          )}

          {/* QR GUIDE */}
          {activeTab === 'qrguide' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-blue-900 mb-4">QR Check-in System Guide</h2>
                <p className="text-gray-700 mb-6">
                  Our event uses a modern QR code-based check-in system for quick, efficient attendee 
                  registration with offline support.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-600">
                  <h3 className="font-bold text-blue-900 text-lg mb-4">🔲 What You Need</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>✓ Your QR code (emailed or printed)</li>
                    <li>✓ Any smartphone or tablet</li>
                    <li>✓ Camera access (for mobile device)</li>
                    <li>✓ Works offline too!</li>
                  </ul>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-600">
                  <h3 className="font-bold text-green-900 text-lg mb-4">✅ Check-in Process</h3>
                  <ol className="space-y-2 text-gray-700 text-sm">
                    <li><strong>1.</strong> Open check-in app/scanner</li>
                    <li><strong>2.</strong> Point camera at your QR code</li>
                    <li><strong>3.</strong> Instant confirmation</li>
                    <li><strong>4.</strong> Get your badge/wristband</li>
                  </ol>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-600">
                <h3 className="font-bold text-purple-900 text-lg mb-4">📱 Manual Entry Option</h3>
                <p className="text-gray-700 mb-4">
                  If you don't have a QR code, staff can enter your details:
                </p>
                <div className="bg-white p-4 rounded border border-purple-200 font-mono text-sm text-gray-700">
                  Format: NAME|EMAIL|PHONE|CATEGORY
                  <br /><br />
                  Example: John Doe|john@email.com|+255787576900|Youth
                </div>
              </div>

              <div className="bg-orange-50 p-6 rounded-lg border-l-4 border-orange-600">
                <h3 className="font-bold text-orange-900 text-lg mb-4">💡 Benefits</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>⚡ <strong>Fast:</strong> Check-in in under 5 seconds</li>
                  <li>📊 <strong>Accurate:</strong> Real-time attendance tracking</li>
                  <li>🔌 <strong>Works Offline:</strong> No internet needed</li>
                  <li>📱 <strong>Mobile-First:</strong> Optimized for smartphones</li>
                  <li>🔒 <strong>Secure:</strong> Your data is protected</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-900 text-lg mb-4">❓ FAQ</h3>
                <div className="space-y-3 text-gray-700 text-sm">
                  <div>
                    <strong>Q: What if I lose my QR code?</strong>
                    <p className="text-gray-600">A: Just let staff know - we can look up your registration or use manual entry.</p>
                  </div>
                  <div>
                    <strong>Q: Do I need internet?</strong>
                    <p className="text-gray-600">A: No! The system works offline and syncs when connection is available.</p>
                  </div>
                  <div>
                    <strong>Q: Can I check in early?</strong>
                    <p className="text-gray-600">A: Yes! Check-in opens on Thursday morning, 18 June.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <button className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-lg transition flex items-center justify-center gap-2 text-lg shadow-lg">
            <Download className="w-6 h-6" />
            Download Brochure PDF
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition flex items-center justify-center gap-2 text-lg shadow-lg">
            <Phone className="w-6 h-6" />
            Register Now
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-blue-900 text-white py-8 px-4 mt-12">
        <div className="max-w-6xl mx-auto text-center">
          <p className="mb-3 font-semibold">2026 Africa Convention</p>
          <p className="text-blue-100">
            Arusha, Tanzania • 18-22 June 2026<br />
            www.livinghope.or.tz • wccm.tz@gmail.com
          </p>
          <p className="text-blue-300 text-sm mt-4">
            Organized by: Living Hope Mission • WCCM • YWAM
          </p>
        </div>
      </div>
    </div>
  );
}
