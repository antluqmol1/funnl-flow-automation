
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Types based on the existing Supabase schema
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type FunnelStage = Database['public']['Tables']['funnel_stages']['Row'];
export type Recording = Database['public']['Tables']['recordings']['Row'];
export type Automation = Database['public']['Tables']['automations']['Row'];

// Contacts services
export const getContacts = async (): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*');
  
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
    .maybeSingle();
  
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
    .select('*');
  
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
    .order('position', { ascending: true });
  
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
    .select('*, contact:contacts(*)');
  
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
    .maybeSingle();
  
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
    .select('*');
  
  if (error) {
    console.error('Error fetching automations:', error);
    throw error;
  }
  
  return data || [];
};
