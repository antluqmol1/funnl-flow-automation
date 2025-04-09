
import { supabase } from "@/integrations/supabase/client";

// Define interfaces for our data models
export interface Contact {
  id: string;
  name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  avatar: string | null;
  status: 'prospect' | 'opportunity' | 'customer';
  last_contact: string | null;
  value: number | null;
  probability: number | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Task {
  id: string;
  title: string;
  type: 'call' | 'email' | 'meeting' | 'follow-up' | 'other';
  time: string;
  contact_id: string | null;
  status: 'pending' | 'completed' | 'overdue';
  priority: 'high' | 'medium' | 'low';
  created_at: string | null;
  updated_at: string | null;
}

export interface FunnelStage {
  id: string;
  name: string;
  position: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Recording {
  id: string;
  title: string;
  contact_id: string | null;
  date: string;
  duration: string;
  transcription: string | null;
  summary: string | null;
  key_points: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  last_run: string | null;
  tasks_completed: number | null;
  created_at: string | null;
  updated_at: string | null;
}

// Contacts services
export const getContacts = async (): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*') as { data: Contact[] | null, error: any };
  
  if (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
  
  return data || [];
};

export const getContactById = async (id: string): Promise<Contact | null> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle() as { data: Contact | null, error: any };
  
  if (error) {
    console.error(`Error fetching contact with id ${id}:`, error);
    throw error;
  }
  
  return data;
};

// Tasks services
export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*') as { data: Task[] | null, error: any };
  
  if (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
  
  return data || [];
};

// Funnel stages services
export const getFunnelStages = async (): Promise<FunnelStage[]> => {
  const { data, error } = await supabase
    .from('funnel_stages')
    .select('*')
    .order('position', { ascending: true }) as { data: FunnelStage[] | null, error: any };
  
  if (error) {
    console.error('Error fetching funnel stages:', error);
    throw error;
  }
  
  return data || [];
};

// Get funnel stages with contacts for each stage
export const getFunnelStagesWithContacts = async () => {
  // First get all the funnel stages
  const stages = await getFunnelStages();
  
  // Then get all contacts
  const contacts = await getContacts();
  
  // Map contacts to their respective stages based on status
  return stages.map(stage => {
    // Map stage name to contact status (lowercase stage name should match status)
    const stageStatus = stage.name.toLowerCase();
    
    const stageContacts = contacts.filter(contact => {
      // For 'Prospects' stage, match 'prospect' status
      // For 'Opportunities' stage, match 'opportunity' status
      // For 'Customers' stage, match 'customer' status
      const statusMatch = contact.status === stageStatus.replace(/s$/, '');
      return statusMatch;
    });
    
    return {
      ...stage,
      contacts: stageContacts,
    };
  });
};

// Recordings services
export const getRecordings = async (): Promise<Recording[]> => {
  const { data, error } = await supabase
    .from('recordings')
    .select('*, contact:contacts(*)') as { data: (Recording & { contact: Contact })[] | null, error: any };
  
  if (error) {
    console.error('Error fetching recordings:', error);
    throw error;
  }
  
  return data || [];
};

export const getRecordingById = async (id: string) => {
  const { data, error } = await supabase
    .from('recordings')
    .select('*, contact:contacts(*)')
    .eq('id', id)
    .maybeSingle() as { data: (Recording & { contact: Contact }) | null, error: any };
  
  if (error) {
    console.error(`Error fetching recording with id ${id}:`, error);
    throw error;
  }
  
  return data;
};

// Automations services
export const getAutomations = async (): Promise<Automation[]> => {
  const { data, error } = await supabase
    .from('automations')
    .select('*') as { data: Automation[] | null, error: any };
  
  if (error) {
    console.error('Error fetching automations:', error);
    throw error;
  }
  
  return data || [];
};
