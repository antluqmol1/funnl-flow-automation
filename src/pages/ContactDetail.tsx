
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { contacts } from '@/lib/dummyData';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import { ArrowLeft, Phone, Mail, MessageSquare, Calendar, Clock, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const contact = contacts.find(c => c.id === id);

  if (!contact) {
    return (
      <div className="mobile-container p-4">
        <Link to="/funnel" className="flex items-center text-funnl-primary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Funnel
        </Link>
        <div className="text-center p-8">
          <h2 className="text-lg font-semibold text-gray-800">Contact not found</h2>
        </div>
      </div>
    );
  }

  const getStatusClass = () => {
    switch (contact.status) {
      case 'prospect':
        return 'bg-blue-100 text-blue-800';
      case 'opportunity':
        return 'bg-yellow-100 text-yellow-800';
      case 'customer':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="mobile-container">
      <PageHeader title={contact.name} subtitle={`${contact.position} at ${contact.company}`} />
      
      <div className="p-4">
        <Link to="/funnel" className="flex items-center text-funnl-primary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Funnel
        </Link>
        
        <div className="funnl-card mb-6">
          <div className="flex justify-between mb-4">
            <span className={`funnl-badge ${getStatusClass()}`}>
              {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
            </span>
            
            {contact.lastContact && (
              <span className="text-xs text-gray-500">
                Last contact: {contact.lastContact}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button variant="outline" className="flex items-center justify-center gap-2">
              <Phone className="h-4 w-4" />
              Call
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </Button>
            <Button variant="outline" className="flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Email</span>
              <span className="text-sm font-medium">{contact.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Phone</span>
              <span className="text-sm font-medium">{contact.phone}</span>
            </div>
            {contact.value && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Deal Value</span>
                <span className="text-sm font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0
                  }).format(contact.value)}
                </span>
              </div>
            )}
            {contact.probability && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Probability</span>
                <span className="text-sm font-medium">{contact.probability}%</span>
              </div>
            )}
          </div>
          
          {contact.tags && contact.tags.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag, index) => (
                  <span key={index} className="funnl-badge bg-gray-100 text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <h2 className="section-title">Recent Activities</h2>
          <div className="funnl-item">
            <div className="flex items-start">
              <div className="bg-gray-100 p-2 rounded-full mr-3">
                <Clock className="h-4 w-4 text-gray-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Follow-up call</h3>
                <p className="text-sm text-gray-600">Yesterday at 2:30 PM</p>
              </div>
            </div>
          </div>
          <div className="funnl-item">
            <div className="flex items-start">
              <div className="bg-gray-100 p-2 rounded-full mr-3">
                <Mail className="h-4 w-4 text-gray-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Sent proposal</h3>
                <p className="text-sm text-gray-600">Oct 15, 2023 at 10:15 AM</p>
              </div>
            </div>
          </div>
          <div className="funnl-item">
            <div className="flex items-start">
              <div className="bg-gray-100 p-2 rounded-full mr-3">
                <FileText className="h-4 w-4 text-gray-700" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Created contact</h3>
                <p className="text-sm text-gray-600">Oct 10, 2023 at 9:00 AM</p>
              </div>
            </div>
          </div>
          
          <Link to="#" className="flex items-center justify-center text-sm text-funnl-primary font-medium mt-3">
            View all activities
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default ContactDetail;
