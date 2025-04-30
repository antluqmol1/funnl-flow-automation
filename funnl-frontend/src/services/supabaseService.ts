import { supabase } from "@/lib/supabase";
import { PostgrestError } from "@supabase/supabase-js";
import apiClient from '@/lib/axiosClient';

// Define interfaces for our data models
export interface Contact {
  id: string;
  name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  avatar: string | null;
  status: string;
  last_contact: string | null;
  value: number | null;
  probability: number | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
  hubspot_id?: string | null;
  hubspot_type?: string | null;
  user_id?: string | null;
  hubspot_company_id?: string | null;
  stage_id?: string | null; // ID de la etapa del pipeline
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
  // Nuevos campos para HubSpot
  hubspot_id: string | null;
  hubspot_type: 'deal' | 'ticket' | 'contact' | 'company' | null;
  hubspot_owner: string | null;
  hubspot_status: string | null;
  hubspot_last_synced: string | null;
  sync_status: 'synced' | 'pending' | 'error' | null;
  hubspot_task_id?: string | null;
}

export interface FunnelStage {
  id: string;
  name: string;
  position: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string | null;
  pipeline_id: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Deal {
  id: string;
  title: string;
  description: string | null;
  company: string;
  contact_id: string | null;
  value: number | null;
  currency: string | null;
  stage_id: string;
  owner_id: string | null;
  probability: number | null;
  expected_close_date: string | null;
  tags: string[] | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  hubspot_id?: string | null;
  hubspot_type?: string | null;
  hubspot_company_id?: string | null;
}

export interface Recording {
  id: string;
  title: string;
  contact_id: string | null;
  date: string; // Este campo parece no usarse y no estar en la BD, considerar eliminar
  duration: string; // Debería ser number (duration_seconds) o string?
  transcription: string | null;
  summary: string | null;
  key_points: string[] | null;
  created_at: string | null;
  updated_at: string | null;
  file_path?: string | null;
  user_id?: string | null;
  status?: 'recorded' | 'processing' | 'completed' | 'failed' | null; // <-- Actualizado
  segments?: Array<{ start: number; end: number; text: string;[key: string]: any }> | null; // <-- Añadido tipo para segmentos
  // Campos potenciales de la tabla meeting_recordings:
  file_name?: string | null;
  size_bytes?: number | null;
  mime_type?: string | null;
  duration_seconds?: number | null; // Usar este en lugar de duration?

  // --- NUEVO: Añadir campo para acciones sugeridas ---
  suggested_actions?: Array<{
    id: string;
    description: string;
    mcp_tool: string;
    arguments: any; // Usamos 'any' por simplicidad, podría tiparse más estrictamente
    confirmation_required: boolean;
  }> | null;
  // --- FIN NUEVO ---
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

// --- MODIFIED: Make interface generic using 'items' ---
export interface FunnelStageWithItems {
  id: number;
  name: string;
  color: string;
  items: (Contact | Deal)[]; // Array can hold Contacts or Deals
}

// Contacts services
export const getContacts = async (): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*') as { data: Contact[] | null, error: PostgrestError | null };

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

export const getTaskById = async (id: string): Promise<Task | null> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single() as { data: Task | null, error: any };

  if (error) {
    console.error(`Error fetching task ${id}:`, error);
    throw error;
  }

  return data;
};

export const createTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select() as { data: Task[] | null, error: any };

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('No data returned from task creation');
  }

  return data[0];
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<any> => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    console.error(`Error updating task ${id}:`, error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(`No data returned from updating task ${id}`);
  }

  return data[0];
};

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting task ${id}:`, error);
    throw error;
  }
};

export const getTasksByHubspotId = async (hubspotId: string, hubspotType: string): Promise<Task[]> => {
  try {
    // Usamos una implementación simple sin complejidad de tipos
    const result = await supabase
      .from('tasks')
      .select('*')
      .eq('hubspot_id', hubspotId)
      .eq('hubspot_type', hubspotType);

    if (result.error) {
      console.error(`Error fetching tasks for HubSpot ID ${hubspotId}:`, result.error);
      return [];
    }

    // Tratamos los datos directamente como un array de Task
    return result.data as Task[];
  } catch (error) {
    console.error(`Error in getTasksByHubspotId for HubSpot ID ${hubspotId}:`, error);
    return [];
  }
};

export const syncTaskWithHubspot = async (taskId: string, hubspotId: string, hubspotType: string): Promise<{ success: boolean }> => {
  try {
    // Esta función actualizaría una tarea local con datos de HubSpot
    // En una implementación real, aquí se llamaría a la API de HubSpot para sincronizar
    const updates: Partial<Task> = {
      hubspot_id: hubspotId,
      hubspot_type: hubspotType as Task['hubspot_type'],
      hubspot_last_synced: new Date().toISOString(),
      sync_status: 'synced'
    };

    await updateTask(taskId, updates);
    return { success: true };
  } catch (error) {
    console.error('Error al sincronizar tarea con HubSpot:', error);
    return { success: false };
  }
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

// --- MODIFIED: getFunnelStagesWithContacts to use 'items' and new interface ---
export const getFunnelStagesWithContacts = async (): Promise<FunnelStageWithItems[]> => {
  try {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      console.error('No hay sesión activa para obtener las etapas del funnel');
      return [];
    }

    const { data: pipelineStages, error: pipelineStagesError } = await supabase
      .from('pipeline_stages').select('*');
    if (pipelineStagesError) {
      console.error('Error fetching pipeline stages:', pipelineStagesError);
      return [];
    }

    const stageIdToFunnelStageMap: Record<string, string> = {};
    if (pipelineStages) {
      pipelineStages.forEach((stage) => {
        const stageName = stage.name.toLowerCase();
        if (stageName.includes('suscriptor')) stageIdToFunnelStageMap[stage.id] = 'Suscriptores';
        else if (stageName.includes('lead')) stageIdToFunnelStageMap[stage.id] = 'Leads';
        else if (stageName.includes('mql')) stageIdToFunnelStageMap[stage.id] = 'MQLs';
        else if (stageName.includes('sql')) stageIdToFunnelStageMap[stage.id] = 'SQLs';
        else if (stageName.includes('oportunidad') || stageName.includes('opportunity')) stageIdToFunnelStageMap[stage.id] = 'Oportunidades';
        else if (stageName.includes('cliente') || stageName.includes('customer')) stageIdToFunnelStageMap[stage.id] = 'Clientes';
        else if (stageName.includes('evangelista') || stageName.includes('evangelist')) stageIdToFunnelStageMap[stage.id] = 'Evangelistas';
        else stageIdToFunnelStageMap[stage.id] = 'Otros';
      });
    }

    const { data: contacts, error: contactsError } = await supabase
      .from('contacts').select('*, tasks(*)');
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      return [];
    }

    // Define stages using the new interface
    const funnelStages: FunnelStageWithItems[] = [
      { id: 1, name: 'Suscriptores', color: '#94A3B8', items: [] },
      { id: 2, name: 'Leads', color: '#FCD34D', items: [] },
      { id: 3, name: 'MQLs', color: '#FCA5A5', items: [] },
      { id: 4, name: 'SQLs', color: '#FDBA74', items: [] },
      { id: 5, name: 'Oportunidades', color: '#A5B4FC', items: [] },
      { id: 6, name: 'Clientes', color: '#86EFAC', items: [] },
      { id: 7, name: 'Evangelistas', color: '#A78BFA', items: [] },
      { id: 8, name: 'Otros', color: '#CBD5E1', items: [] },
    ];

    const normalizeStatus = (status: string): string => {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus.includes('suscriptor') || lowerStatus.includes('subscriber')) return 'Suscriptores';
      if (lowerStatus.includes('lead')) return 'Leads';
      if (lowerStatus.includes('mql')) return 'MQLs';
      if (lowerStatus.includes('sql')) return 'SQLs';
      if (lowerStatus.includes('oportunidad') || lowerStatus.includes('opportunity')) return 'Oportunidades';
      if (lowerStatus.includes('cliente') || lowerStatus.includes('customer')) return 'Clientes';
      if (lowerStatus.includes('evangelista') || lowerStatus.includes('evangelist')) return 'Evangelistas';
      return 'Otros';
    };

    if (contacts) {
      contacts.forEach((contactData: any) => {
        const tasksCount = contactData.tasks ? contactData.tasks.length : 0;
        const contact = { ...contactData, tasksCount } as Contact & { tasksCount: number };
        let mappedFunnelStageName = 'Otros'; // Default to Otros
        if (contact.stage_id && stageIdToFunnelStageMap[contact.stage_id]) {
          mappedFunnelStageName = stageIdToFunnelStageMap[contact.stage_id];
        } else if (contact.status) {
          mappedFunnelStageName = normalizeStatus(contact.status);
        }
        contact.status = mappedFunnelStageName; // Update status for filtering consistency
        const targetStage = funnelStages.find(fs => fs.name === mappedFunnelStageName);
        if (targetStage) {
          targetStage.items.push(contact); // Push to items array
        }
      });
    }
    return funnelStages;
  } catch (error) {
    console.error('Error in getFunnelStagesWithContacts:', error);
    return [];
  }
};

// Recordings services
export const getRecordings = async (): Promise<Recording[]> => {
  console.log('[supabaseService][getRecordings] Intentando obtener grabaciones...');

  // La consulta es simple porque RLS filtra por usuario automáticamente
  const { data, error } = await supabase
    .from('meeting_recordings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supabaseService][getRecordings] Error al obtener grabaciones:', error);
    throw error;
  }

  console.log(`[supabaseService][getRecordings] Grabaciones obtenidas: ${data?.length ?? 0}`);
  return data || [];
};

export const getRecordingById = async (id: string): Promise<Recording | null> => {
  console.log(`[supabaseService][getRecordingById] Intentando obtener grabación ID: ${id}`);
  const { data, error } = await supabase
    .from('meeting_recordings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn(`[supabaseService][getRecordingById] Grabación no encontrada (o acceso denegado por RLS) para ID: ${id}. Error: ${error.message}`);
      return null;
    } else {
      console.error(`[supabaseService][getRecordingById] Error al obtener grabación ID ${id}:`, error);
      throw error;
    }
  }

  if (data) {
    console.log(`[supabaseService][getRecordingById] Grabación encontrada para ID: ${id}. Status: ${data.status}`);
  } else {
    console.log(`[supabaseService][getRecordingById] No se devolvieron datos para ID: ${id}, probablemente no encontrada.`);
  }

  return data as Recording | null;
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

// Pipeline services
export const getPipelines = async (): Promise<Pipeline[]> => {
  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching pipelines:', error);
    throw error;
  }

  return data || [];
};

export const getPipelineStages = async (pipelineId: string): Promise<PipelineStage[]> => {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching pipeline stages:', error);
    throw error;
  }

  return data || [];
};

export const getDeals = async (): Promise<Deal[]> => {
  const { data, error } = await supabase
    .from('deals')
    .select('*');

  if (error) {
    console.error('Error fetching deals:', error);
    throw error;
  }

  return data || [];
};

export const getDealsByStage = async (stageId: string): Promise<Deal[]> => {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('stage_id', stageId);

  if (error) {
    console.error(`Error fetching deals for stage ${stageId}:`, error);
    throw error;
  }

  return data || [];
};

// --- Added getContactsByStage function ---
export const getContactsByStage = async (stageId: string): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts') // Query the contacts table
    .select('*')      // Select all contact fields (or specify needed ones)
    .eq('stage_id', stageId); // Filter by stage_id

  if (error) {
    console.error(`Error fetching contacts for stage ${stageId}:`, error);
    throw error;
  }

  return data || [];
};
// --- End added function ---

// Helper utility for formatting currency
export const formatCurrency = (value: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Sincroniza un deal con HubSpot
export const syncDealWithHubspot = async (
  dealId: string
): Promise<{ success: boolean; message?: string }> => {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    console.warn('No hay sesión activa para sincronizar con HubSpot');
    return { success: false, message: 'No hay sesión activa' };
  }

  try {
    // Obtener información del deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*, stage_id')
      .eq('id', dealId)
      .single();

    if (dealError) {
      console.error('Error fetching deal for HubSpot sync:', dealError);
      return { success: false, message: 'Error obteniendo datos del deal' };
    }

    // Validar si el deal existe y tiene una etapa asignada
    if (!deal || !deal.stage_id) {
      console.error('Deal or stage_id not found for HubSpot sync');
      return { success: false, message: 'Error obteniendo datos del deal' };
    }

    // Si el deal tiene una etapa asignada, obtenemos sus datos
    let stageName = '', stagePosition: number | undefined;
    if (deal.stage_id) {
      const { data: stageData, error: stageError } = await supabase
        .from('pipeline_stages')
        .select('name, position')
        .eq('id', deal.stage_id)
        .single();

      if (!stageError && stageData) {
        stageName = stageData.name;
        stagePosition = stageData.position;
      }
    }

    // Realizamos la sincronización con HubSpot
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // Default for safety
    const hubspotResponse = await fetch(`${API_URL}/api/hubspot/sync-deal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: dealId,
        type: 'deal',
        force: true, // Consider if force should always be true
        stage_name: stageName,
        stage_position: stagePosition
      })
    });

    if (!hubspotResponse.ok) {
      const errorData = await hubspotResponse.json().catch(() => ({}));
      console.error(errorData.detail || 'Error al sincronizar el deal con HubSpot');
      return {
        success: false,
        message: errorData.detail || 'Error al sincronizar el deal con HubSpot'
      };
    }

    await hubspotResponse.json();
    return { success: true, message: 'Deal sincronizado correctamente' };
  } catch (error) {
    console.error('Error sincronizando deal con HubSpot:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

// Busca deals en HubSpot por término de búsqueda
export const searchHubspotDeals = async (query: string): Promise<{ deals: any[] }> => {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('No hay sesión activa');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${API_URL}/hubspot/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'deal',
        query: query
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error buscando deals en HubSpot');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error buscando deals en HubSpot:', error);
    // Devolvemos un array vacío en caso de error para mantener la estructura de retorno
    return { deals: [] };
  }
};

export const createDeal = async (deal: Omit<Deal, 'id' | 'created_at' | 'updated_at'>): Promise<Deal> => {
  try {
    const { data, error } = await supabase
      .from('deals')
      .insert(deal)
      .select()
      .single();

    if (error) {
      console.error('Error creating deal:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from deal creation');
    }

    // Intentar sincronizar automáticamente con HubSpot después de crear el deal
    try {
      // Solo sincronizamos si hay una sesión activa
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult.data.session) {
        // Sincronización en segundo plano para no bloquear la creación
        syncDealWithHubspot(data.id).catch(syncError => {
          console.warn('Error al sincronizar deal con HubSpot (continuando):', syncError);
          // No hacemos throw del error para no bloquear la creación del deal
        });
      }
    } catch (syncError) {
      // Si falla la sincronización, continuamos igualmente
      console.warn('Error al intentar sincronizar con HubSpot:', syncError);
      // No bloqueamos la creación del deal por un error de sincronización
    }

    return data;
  } catch (createError) {
    console.error('Error en proceso de creación de deal:', createError);
    throw createError;
  }
};

export const updateDeal = async (id: string, updates: Partial<Deal>): Promise<Deal> => {
  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating deal ${id}:`, error);
    throw error;
  }

  if (!data) {
    throw new Error(`No data returned from updating deal ${id}`);
  }

  // Intentar sincronizar automáticamente con HubSpot después de actualizar el deal
  try {
    // Solo sincronizamos si hay una sesión activa
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.data.session) {
      // Sincronización en segundo plano para no bloquear la actualización
      syncDealWithHubspot(id).catch(syncError => {
        console.warn('Error al sincronizar deal con HubSpot después de actualizar (continuando):', syncError);
        // No hacemos throw del error para no bloquear la actualización del deal
      });
    }
  } catch (syncError) {
    // Si falla la sincronización, continuamos igualmente
    console.warn('Error al intentar sincronizar con HubSpot después de actualizar:', syncError);
    // No bloqueamos la actualización del deal por un error de sincronización
  }

  return data;
};

export const deleteDeal = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting deal ${id}:`, error);
    throw error;
  }
};

// --- MODIFIED getPipelineWithStages function ---
export const getPipelineWithStages = async (pipelineId: string) => {
  // First get the pipeline details to determine its type
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .select('id, name, description, is_active, icon, color, sort_order') // Assume a 'type' column exists or infer from name
    .eq('id', pipelineId)
    .single();

  if (pipelineError) {
    console.error(`Error fetching pipeline ${pipelineId}:`, pipelineError);
    throw pipelineError;
  }

  if (!pipeline) {
    throw new Error(`Pipeline with ID ${pipelineId} not found`);
  }

  // Determine if it's a contact pipeline (inferring from name as before)
  // In a real scenario, a dedicated 'type' column ('CONTACT' | 'DEAL') in the pipelines table would be better.
  const isContactPipeline = pipeline.name.toLowerCase().includes('contacto');

  // Get all stages for this pipeline
  const stages = await getPipelineStages(pipelineId);

  // For each stage, get the appropriate items (contacts or deals)
  const stagesWithItems = await Promise.all(
    stages.map(async (stage) => {
      let items = [];
      try {
        if (isContactPipeline) {
          items = await getContactsByStage(stage.id);
        } else {
          items = await getDealsByStage(stage.id);
        }
      } catch (error) {
        console.error(`Error fetching items for stage ${stage.id} in pipeline ${pipelineId}:`, error);
        // Continue fetching for other stages, return empty items for this one
      }
      return {
        ...stage,
        items: items // Use a consistent 'items' key
      };
    })
  );

  return {
    ...pipeline,
    stages: stagesWithItems // Return stages with 'items' array
  };
};
// --- End MODIFIED function ---

// Busca empresas en HubSpot por término de búsqueda
export const searchHubspotCompanies = async (query: string): Promise<{ results: any[] }> => {
  try {
    // apiClient ya incluye el token, no se necesita getSession aquí

    // Endpoint correcto
    const apiUrl = '/api/hubspot/companies/search';

    // Llamada con apiClient y payload correcto
    const response = await apiClient.post<{
      success: boolean;
      data: { total: number; results: any[] }
    }>(apiUrl, {
      searchTerm: query
    });

    // Devolver solo los resultados como antes, o adaptar donde se llama esta función
    return response.data.data || { results: [] }; // Extraer de la estructura anidada

  } catch (error: any) {
    console.error('Error buscando empresas en HubSpot:', error);
    // Lanzar el error para que el componente que llama pueda manejarlo
    // O devolver un objeto con error si se prefiere no lanzar
    const errorMessage = error.response?.data?.message || error.message || 'Error buscando empresas en HubSpot';
    throw new Error(errorMessage);
  }
};

// Busca contactos en HubSpot por término de búsqueda
export const searchHubspotContacts = async (query: string): Promise<{ results: any[] }> => {
  try {
    // apiClient ya incluye el token, no se necesita getSession aquí

    // Endpoint correcto
    const apiUrl = '/api/hubspot/contacts/search';

    // Llamada con apiClient y payload correcto
    const response = await apiClient.post<{
      success: boolean;
      data: { total: number; results: any[] }
    }>(apiUrl, {
      searchTerm: query
    });

    // Devolver solo los resultados como antes, o adaptar donde se llama esta función
    return response.data.data || { results: [] }; // Extraer de la estructura anidada

  } catch (error: any) {
    console.error('Error buscando contactos en HubSpot:', error);
    // Lanzar el error para que el componente que llama pueda manejarlo
    const errorMessage = error.response?.data?.message || error.message || 'Error buscando contacts en HubSpot';
    throw new Error(errorMessage);
  }
};

export const createContact = async (contact: {
  name: string;
  email: string;
  company: string;
  position: string;
  phone: string;
  status: string;
  hubspot_company_id?: string | null;
  stage_id?: string; // ID de la etapa del pipeline
  value?: number | null;
  probability?: number | null;
  tags?: string[] | null;
}): Promise<Contact> => {
  try {
    // Obtener la sesión actual para conseguir el ID del usuario
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session?.user) {
      throw new Error('No hay sesión activa para crear contactos');
    }

    // Preparamos el contacto con datos adicionales para que funcione tanto en Pipeline como en Funnel
    const contactToInsert = {
      ...contact,
      user_id: sessionData.session.user.id,
      // Aseguramos que siempre tenga un status compatible con el funnel si no viene especificado
      status: contact.status || 'lead',
      // Inicializamos otros campos que puedan ser útiles
      last_contact: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      value: contact.value || 0,
      probability: contact.probability || 50,
      // Aseguramos que tenga un array de tags vacío si no viene
      tags: contact.tags || []
    };

    // Insertar el contacto con todos los campos necesarios
    const { data, error } = await supabase
      .from('contacts')
      .insert(contactToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from contact creation');
    }

    // Si se proporciona stage_id, también creamos una entrada en pipeline_items
    // para asegurar que aparezca tanto en el funnel como en el pipeline
    if (contact.stage_id) {
      try {
        // Crear entrada en pipeline_items para el contacto
        await supabase.from('pipeline_items').insert({
          contact_id: data.id,
          stage_id: contact.stage_id,
          title: data.name,
          company: data.company,
          value: data.value || 0,
          currency: 'EUR',
          status: data.status,
          priority: 'medium',
          probability: data.probability || 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (pipelineError) {
        console.warn('Error al crear item en pipeline:', pipelineError);
        // No bloqueamos la creación del contacto por un error en pipeline_items
      }
    }

    // Intentar sincronizar automáticamente con HubSpot después de crear el contacto
    try {
      // TODO: Implementar sincronización de contactos con HubSpot similar a deals
      console.log('Contacto creado:', data.id);
    } catch (syncError) {
      console.warn('Error al intentar sincronizar contacto con HubSpot:', syncError);
    }

    return data;
  } catch (createError) {
    console.error('Error en proceso de creación de contacto:', createError);
    throw createError;
  }
};

// Función para migrar contactos del pipeline al funnel (y viceversa)
export const syncPipelineContactsWithFunnel = async (): Promise<{ success: boolean, message: string }> => {
  try {
    // 1. Obtener todos los contactos de la tabla contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, company, stage_id');

    if (contactsError) {
      console.error('Error al obtener contactos:', contactsError);
      return { success: false, message: 'Error al obtener contactos' };
    }

    // 2. Obtener todos los items del pipeline
    const { data: pipelineItems, error: pipelineError } = await supabase
      .from('pipeline_items')
      .select('id, contact_id, stage_id, title, company');

    if (pipelineError) {
      console.error('Error al obtener items del pipeline:', pipelineError);
      return { success: false, message: 'Error al obtener items del pipeline' };
    }

    // 3. Crear entries en pipeline_items para contactos que no estén ya allí
    let createdCount = 0;
    for (const contact of contacts) {
      // Verificar si el contacto ya tiene un item en el pipeline
      const hasItem = pipelineItems.some(item => item.contact_id === contact.id);

      if (!hasItem && contact.stage_id) {
        try {
          await supabase.from('pipeline_items').insert({
            contact_id: contact.id,
            stage_id: contact.stage_id,
            title: contact.name,
            company: contact.company,
            status: 'active',
            priority: 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          createdCount++;
        } catch (error) {
          console.warn(`Error al crear pipeline item para contacto ${contact.id}:`, error);
        }
      }
    }

    // 4. Actualizar contactos que están en pipeline_items pero no tienen stage_id
    let updatedCount = 0;
    for (const item of pipelineItems) {
      if (item.contact_id) {
        const contact = contacts.find(c => c.id === item.contact_id);

        if (contact && !contact.stage_id) {
          try {
            await supabase
              .from('contacts')
              .update({ stage_id: item.stage_id })
              .eq('id', contact.id);
            updatedCount++;
          } catch (error) {
            console.warn(`Error al actualizar stage_id del contacto ${contact.id}:`, error);
          }
        }
      }
    }

    return {
      success: true,
      message: `Sincronización completada: ${createdCount} items creados, ${updatedCount} contactos actualizados`
    };
  } catch (error) {
    console.error('Error en la sincronización pipeline-funnel:', error);
    return { success: false, message: 'Error en la sincronización' };
  }
};

// --- Added deleteContact function ---
export const deleteContact = async (contactId: string): Promise<void> => {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) {
    console.error(`Error deleting contact ${contactId}:`, error);
    throw error;
  }
};
// --- End added function ---

// --- Added updateContact function ---
export const updateContact = async (id: string, updates: Partial<Contact>): Promise<Contact> => {
  // Asegurarse de actualizar el timestamp
  const updatesWithTimestamp = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('contacts')
    .update(updatesWithTimestamp)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating contact ${id}:`, error);
    throw error;
  }

  // TODO: Considerar si se necesita sincronizar con HubSpot después de actualizar
  // try { syncContactWithHubspot(id); } catch(e) { console.warn('Sync failed') }

  return data;
};
// --- End added function ---

// --- MODIFIED: getSalesFunnelData to use 'items' and new interface ---
export const getSalesFunnelData = async (): Promise<FunnelStageWithItems[]> => {
  try {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      console.error('No active session for fetching sales funnel data');
      return [];
    }

    // Define stages using the new interface
    const salesFunnelStages: FunnelStageWithItems[] = [
      { id: 1, name: 'Captado', color: '#BFDBFE', items: [] },
      { id: 2, name: 'Cultivado', color: '#FDE68A', items: [] },
      { id: 3, name: 'Demo', color: '#FECACA', items: [] },
      { id: 4, name: 'Negociación', color: '#FED7AA', items: [] },
      { id: 5, name: 'Ganado', color: '#A7F3D0', items: [] },
    ];

    const allPipelines = await getPipelines();
    const salesPipeline = allPipelines.find(p => !p.name.toLowerCase().includes('contacto'));
    if (!salesPipeline) {
      console.error("Sales pipeline not found.");
      return [];
    }
    const pipelineStages = await getPipelineStages(salesPipeline.id);

    const stageIdToFunnelMap: Record<string, string> = {};
    pipelineStages.forEach(stage => {
      const stageNameLower = stage.name.toLowerCase();
      if (stageNameLower.includes('captado')) stageIdToFunnelMap[stage.id] = 'Captado';
      else if (stageNameLower.includes('cultivado')) stageIdToFunnelMap[stage.id] = 'Cultivado';
      else if (stageNameLower.includes('demo')) stageIdToFunnelMap[stage.id] = 'Demo';
      else if (stageNameLower.includes('negociación')) stageIdToFunnelMap[stage.id] = 'Negociación';
      else if (stageNameLower.includes('ganado')) stageIdToFunnelMap[stage.id] = 'Ganado';
    });

    const lostStageId = pipelineStages.find(s => s.name.toLowerCase().includes('perdido'))?.id;
    let query = supabase.from('deals').select('*');
    if (lostStageId) {
      query = query.neq('stage_id', lostStageId);
    }
    const { data: deals, error: dealsError } = await query;

    if (dealsError) {
      console.error('Error fetching deals:', dealsError);
      return [];
    }

    if (deals) {
      deals.forEach(deal => {
        if (deal.stage_id && stageIdToFunnelMap[deal.stage_id]) {
          const targetFunnelStageName = stageIdToFunnelMap[deal.stage_id];
          const targetStage = salesFunnelStages.find(fs => fs.name === targetFunnelStageName);
          if (targetStage) {
            targetStage.items.push(deal as Deal); // Push Deal to items array
          }
        }
      });
    }

    // No need to rename, already using 'items'
    return salesFunnelStages;

  } catch (error) {
    console.error('Error fetching sales funnel data:', error);
    return [];
  }
};
// --- End added function ---
