
import React from 'react';
import { Phone, Mail, MessageSquare, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type Contact } from '@/services/supabaseService';

interface ContactCardProps {
  contact: Contact;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact }) => {
  const getContactValue = () => {
    if (!contact.value) return null;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(contact.value);
  };
  
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
    <div className="funnl-item">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-800">{contact.name}</h3>
          <p className="text-sm text-gray-600">{contact.position} at {contact.company}</p>
          
          {(contact.value || contact.probability) && (
            <div className="flex gap-2 mt-1">
              {contact.value && (
                <span className="funnl-badge bg-funnl-soft-purple text-funnl-secondary">
                  {getContactValue()}
                </span>
              )}
              {contact.probability && (
                <span className="funnl-badge bg-gray-100 text-gray-700">
                  {contact.probability}% Probability
                </span>
              )}
            </div>
          )}
        </div>
        
        <span className={`funnl-badge ${getStatusClass()}`}>
          {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
        </span>
      </div>
      
      <div className="mt-3 flex justify-between items-center">
        <div className="flex gap-3">
          <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <Phone className="h-4 w-4 text-gray-700" />
          </button>
          <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <Mail className="h-4 w-4 text-gray-700" />
          </button>
          <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <MessageSquare className="h-4 w-4 text-gray-700" />
          </button>
        </div>
        
        <Link to={`/contact/${contact.id}`} className="flex items-center text-sm text-funnl-primary font-medium">
          Details
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </div>
  );
};

export default ContactCard;
