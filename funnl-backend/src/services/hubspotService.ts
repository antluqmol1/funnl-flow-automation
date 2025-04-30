import { Client } from '@hubspot/api-client';
import axios from 'axios'; // <-- Importar axios
// Importaremos más tipos específicos de HubSpot a medida que los necesitemos
import { SimplePublicObjectInput } from '@hubspot/api-client/lib/codegen/crm/contacts'; // Ejemplo para crear contacto
import { PublicObjectSearchRequest } from '@hubspot/api-client/lib/codegen/crm/contacts'; // Para la búsqueda

// (Opcional pero recomendado) Definir interfaces para las propiedades que usarán tus métodos
interface ContactProperties {
    firstname: string;
    email: string;
    lastname?: string;
    company?: string;
    phone?: string;
    // Añade otras propiedades si las necesitas
}

interface CompanyProperties {
    name: string;
    domain?: string; // El dominio suele ser importante en HubSpot
    description?: string;
    city?: string;
    industry?: string;
    phone?: string;
    // Añade otras propiedades estándar o personalizadas que uses
}

interface DealProperties {
    dealname: string;
    dealstage: string; // Nombre en español (ej: "captado", "negociación"), se mapeará a ID
    pipeline?: string; // ID o nombre del pipeline (si no es el default)
    amount?: string;   // Monto como string
    closedate?: string; // Fecha en formato YYYY-MM-DD o ISO string
    dealtype?: string;
    description?: string;
    // Asociaciones (contactos, empresas) se manejan diferente, no como props directas aquí
}

interface TicketProperties {
    subject: string; // Título/Asunto del ticket
    content: string; // Descripción/contenido del ticket
    hs_pipeline?: string; // ID del pipeline de tickets (si no es el default)
    hs_pipeline_stage?: string; // ID de la etapa del ticket DENTRO del pipeline especificado
    hs_ticket_priority?: 'LOW' | 'MEDIUM' | 'HIGH'; // Prioridad
    hubspot_owner_id?: string; // ID del propietario asignado
    // Puedes añadir otras propiedades estándar o personalizadas
}

// Importaciones específicas para Empresas
import { SimplePublicObjectInput as CompanyInput } from '@hubspot/api-client/lib/codegen/crm/companies';
import { PublicObjectSearchRequest as CompanySearchRequest } from '@hubspot/api-client/lib/codegen/crm/companies';

// Importaciones específicas para Deals
import { SimplePublicObjectInput as DealInput } from '@hubspot/api-client/lib/codegen/crm/deals';
import { PublicObjectSearchRequest as DealSearchRequest } from '@hubspot/api-client/lib/codegen/crm/deals';

// Importaciones específicas para Pipelines API
import { Pipeline } from '@hubspot/api-client/lib/codegen/crm/pipelines';
import { PipelineStage } from '@hubspot/api-client/lib/codegen/crm/pipelines';

// Importaciones específicas para Tickets
import { SimplePublicObjectInput as TicketInput } from '@hubspot/api-client/lib/codegen/crm/tickets';
import { PublicObjectSearchRequest as TicketSearchRequest } from '@hubspot/api-client/lib/codegen/crm/tickets';

export class HubSpotService {
    // Ya no necesitamos el cliente global para operaciones de usuario
    // private hubspotClient: Client;

    // Cache simple para mapas de etapas de deal por usuario (token como clave)
    private userDealStageMapsCache: Map<string, Promise<Record<string, string>>> = new Map();

    constructor() {
        // Comentar o eliminar la inicialización del cliente global
        /*
        const accessToken = process.env.HUBSPOT_TOKEN; // O HUBSPOT_ACCESS_TOKEN
        if (!accessToken) {
            console.error("HUBSPOT_TOKEN no encontrado en las variables de entorno.");
            throw new Error("Configuración incompleta: Falta el token de acceso de HubSpot global.");
        }
        this.hubspotClient = new Client({ accessToken });
        console.log("Servicio HubSpot: Cliente global inicializado (¡será reemplazado por tokens de usuario!).");
        */
        console.log("Servicio HubSpot: Inicializado (usará tokens de usuario por método).");
    }

    /**
     * Obtiene (y cachea) el mapa de etapas { nombre_etapa_minusculas: id_etapa } 
     * para el pipeline de DEALS por defecto de un usuario específico.
     * @param userAccessToken El token de acceso del usuario.
     * @returns Un Promise que resuelve a un Record<string, string> con el mapeo de etapas.
     * @private
     */
    private async _getUserDealStageMap(userAccessToken: string): Promise<Record<string, string>> {
        if (this.userDealStageMapsCache.has(userAccessToken)) {
            console.log("Servicio HubSpot: Devolviendo mapa de etapas de deal cacheado para el usuario.");
            return this.userDealStageMapsCache.get(userAccessToken)!;
        }
        console.log("Servicio HubSpot: Obteniendo mapa de etapas de deal (no cacheado) para el usuario...");

        const mapPromise = new Promise<Record<string, string>>(async (resolve, reject) => {
            try {
                const userClient = new Client({ accessToken: userAccessToken });
                const pipelinesResponse = await userClient.crm.pipelines.pipelinesApi.getAll("DEALS");
                const defaultPipeline = pipelinesResponse.results.find(p => (p as any).default === true);
                if (!defaultPipeline) {
                    console.error("No se encontró pipeline de Deals por defecto.");
                    console.log("Pipelines encontrados:", pipelinesResponse.results.map(p => ({ id: p.id, label: p.label, default: (p as any).default, displayOrder: p.displayOrder })));
                    return reject(new Error("No se pudo determinar el pipeline de Deals por defecto."));
                }
                const defaultPipelineId = defaultPipeline.id;
                console.log(`Servicio HubSpot: Pipeline por defecto ID: ${defaultPipelineId}, Label: ${defaultPipeline.label}`);
                const pipelineDetails = await userClient.crm.pipelines.pipelinesApi.getById("DEALS", defaultPipelineId);
                const stages = pipelineDetails.stages;
                if (!stages || stages.length === 0) {
                    console.error(`No se encontraron etapas para pipeline ${defaultPipelineId}.`);
                    return reject(new Error(`No se encontraron etapas en pipeline ${defaultPipelineId}.`));
                }
                const stageMap: Record<string, string> = {};
                stages.forEach((stage: PipelineStage) => {
                    if (stage.label && stage.label.trim() !== '') {
                        stageMap[stage.label.toLowerCase()] = stage.id;
                    } else {
                        console.warn(`Etapa sin label en pipeline ${defaultPipelineId}, ID: ${stage.id}`);
                    }
                });
                if (Object.keys(stageMap).length === 0) {
                    console.error(`Error: No se pudieron mapear etapas válidas para pipeline ${defaultPipelineId}.`);
                    return reject(new Error(`No se pudieron mapear etapas válidas en pipeline ${defaultPipelineId}.`));
                }
                console.log(`Mapa de etapas construido para pipeline ${defaultPipelineId}:`, stageMap);
                return resolve(stageMap);
            } catch (e: any) {
                console.error("Error obteniendo etapas del pipeline:", e);
                this.userDealStageMapsCache.delete(userAccessToken);
                const errorMessage = e.response?.body?.message || e.message || "Error desconocido";
                const errorStatus = e.response?.statusCode;
                reject(new Error(`Error al obtener etapas ${errorStatus ? `(Status: ${errorStatus})` : ''}: ${errorMessage}`));
            }
        });
        this.userDealStageMapsCache.set(userAccessToken, mapPromise);
        return mapPromise;
    }

    // --- Métodos para Contactos ---

    /**
     * Busca contactos en HubSpot.
     * @param searchTerm Término para buscar.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async findContact(searchTerm: string, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Buscando contacto '${searchTerm}' (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para findContact");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const searchRequest: PublicObjectSearchRequest = {
                query: searchTerm,
                filterGroups: [],
                properties: ["firstname", "lastname", "email", "company", "phone", "hs_object_id"],
                limit: 10,
                after: "0"
            };
            // Usar userClient
            const response = await userClient.crm.contacts.searchApi.doSearch(searchRequest);
            console.log(`Servicio HubSpot: Búsqueda contacto encontró ${response.total} resultados.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual)
            if (e.response) {
                console.error("Error buscando contacto en HubSpot (API):", e.response.body);
                throw new Error(`Error API HubSpot buscando contacto: ${e.response.body?.message || e.message}`);
            } else {
                console.error("Error inesperado buscando contacto en HubSpot:", e.message);
                throw new Error(`Error inesperado buscando contacto: ${e.message}`);
            }
        }
    }

    /**
     * Crea un nuevo contacto en HubSpot.
     * @param properties Propiedades del contacto.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async createContact(properties: ContactProperties, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Creando contacto ${properties.email} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para createContact");
        if (!properties.firstname || !properties.email) {
            throw new Error("'firstname' y 'email' son requeridos.");
        }
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const propertiesToSend: { [key: string]: string } = {};
            for (const key in properties) {
                if (Object.prototype.hasOwnProperty.call(properties, key) && properties[key as keyof ContactProperties] !== undefined) {
                    propertiesToSend[key] = String(properties[key as keyof ContactProperties]);
                }
            }
            const simplePublicObjectInput: SimplePublicObjectInput = { properties: propertiesToSend };
            // Usar userClient
            const response = await userClient.crm.contacts.basicApi.create(simplePublicObjectInput);
            console.log(`Servicio HubSpot: Contacto creado ID: ${response.id}`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual, incluyendo 409)
            if (e.response) {
                console.error("Error creando contacto en HubSpot (API):", e.response.body);
                const errorMessage = e.response.body?.message || e.message;
                const statusCode = e.response.statusCode;
                let customMessage = `Error API HubSpot (${statusCode}) creando contacto: ${errorMessage}`;
                if (statusCode === 409) {
                    customMessage = `Error: Ya existe un contacto con el email '${properties.email}'. (${errorMessage})`;
                }
                throw new Error(customMessage);
            } else {
                console.error("Error inesperado creando contacto en HubSpot:", e.message);
                throw new Error(`Error inesperado creando contacto: ${e.message}`);
            }
        }
    }

    // --- Métodos para Empresas ---

    /**
     * Busca empresas en HubSpot.
     * @param searchTerm Término de búsqueda.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async findCompany(searchTerm: string, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Buscando empresa '${searchTerm}' (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para findCompany");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const searchRequest: CompanySearchRequest = {
                query: searchTerm,
                filterGroups: [],
                properties: ["name", "domain", "city", "industry", "phone", "hs_object_id"],
                limit: 10,
                after: "0"
            };
            // Usar userClient
            const response = await userClient.crm.companies.searchApi.doSearch(searchRequest);
            console.log(`Servicio HubSpot: Búsqueda empresa encontró ${response.total} resultados.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual)
            if (e.response) {
                console.error("Error buscando empresa en HubSpot (API):", e.response.body);
                throw new Error(`Error API HubSpot buscando empresa: ${e.response.body?.message || e.message}`);
            } else {
                console.error("Error inesperado buscando empresa en HubSpot:", e.message);
                throw new Error(`Error inesperado buscando empresa: ${e.message}`);
            }
        }
    }

    /**
     * Obtiene una empresa específica de HubSpot por su ID.
     * @param id El ID de la empresa.
     * @param userAccessToken Token de acceso del usuario.
     * @param propertiesToRequest Propiedades opcionales a solicitar.
     * @returns Promise con los datos de la empresa.
     */
    async getCompany(id: string, userAccessToken: string, propertiesToRequest: string[] = ["name", "domain", "city", "industry", "phone"]): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Obteniendo empresa ID: ${id} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para getCompany");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            // Usar userClient
            const response = await userClient.crm.companies.basicApi.getById(id, propertiesToRequest);
            console.log(`Servicio HubSpot: Empresa ${id} obtenida.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual, incluyendo 404)
            if (e.response) {
                console.error(`Error obteniendo empresa ${id} (API):`, e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) obteniendo empresa ${id}: ${message}`);
            } else {
                console.error(`Error inesperado obteniendo empresa ${id}:`, e.message);
                throw new Error(`Error inesperado obteniendo empresa ${id}: ${e.message}`);
            }
        }
    }

    /**
     * Crea una nueva empresa en HubSpot.
     * @param properties Propiedades de la empresa.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async createCompany(properties: CompanyProperties, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Creando empresa ${properties.name} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para createCompany");
        if (!properties.name) {
            throw new Error("La propiedad 'name' es requerida.");
        }
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const propertiesToSend: { [key: string]: string } = {};
            for (const key in properties) {
                if (Object.prototype.hasOwnProperty.call(properties, key) && properties[key as keyof CompanyProperties] !== undefined) {
                    propertiesToSend[key] = String(properties[key as keyof CompanyProperties]);
                }
            }
            const companyInput: CompanyInput = { properties: propertiesToSend };
            // Usar userClient
            const response = await userClient.crm.companies.basicApi.create(companyInput);
            console.log(`Servicio HubSpot: Empresa creada ID: ${response.id}`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual)
            if (e.response) {
                console.error("Error creando empresa en HubSpot (API):", e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) creando empresa: ${message}`);
            } else {
                console.error("Error inesperado creando empresa en HubSpot:", e.message);
                throw new Error(`Error inesperado creando empresa: ${e.message}`);
            }
        }
    }

    /**
     * Actualiza una empresa existente en HubSpot.
     * @param id El ID de la empresa.
     * @param properties Propiedades a actualizar.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async updateCompany(id: string, properties: Partial<CompanyProperties>, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Actualizando empresa ID: ${id} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para updateCompany");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const propertiesToSend: { [key: string]: string } = {};
            for (const key in properties) {
                if (Object.prototype.hasOwnProperty.call(properties, key) && properties[key as keyof CompanyProperties] !== undefined) {
                    propertiesToSend[key] = String(properties[key as keyof CompanyProperties]);
                }
            }
            if (Object.keys(propertiesToSend).length === 0) {
                throw new Error("No se proporcionaron propiedades para actualizar.");
            }
            const companyInput: CompanyInput = { properties: propertiesToSend };
            // Usar userClient
            const response = await userClient.crm.companies.basicApi.update(id, companyInput);
            console.log(`Servicio HubSpot: Empresa ${id} actualizada.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual, incluyendo 404)
            if (e.response) {
                console.error(`Error actualizando empresa ${id} (API):`, e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) actualizando empresa ${id}: ${message}`);
            } else {
                console.error(`Error inesperado actualizando empresa ${id}:`, e.message);
                throw new Error(`Error inesperado actualizando empresa ${id}: ${e.message}`);
            }
        }
    }

    // --- Métodos para Deals ---

    /**
     * Busca deals en HubSpot.
     * @param searchTerm Término de búsqueda.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async findDeal(searchTerm: string, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Buscando deal '${searchTerm}' (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para findDeal");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const searchRequest: DealSearchRequest = {
                query: searchTerm,
                filterGroups: [],
                properties: ["dealname", "dealstage", "pipeline", "amount", "closedate", "dealtype", "hs_object_id"],
                limit: 10,
                after: "0"
            };
            // Usar userClient
            const response = await userClient.crm.deals.searchApi.doSearch(searchRequest);
            console.log(`Servicio HubSpot: Búsqueda deal encontró ${response.total} resultados.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual)
            if (e.response) {
                console.error("Error buscando deal en HubSpot (API):", e.response.body);
                throw new Error(`Error API HubSpot buscando deal: ${e.response.body?.message || e.message}`);
            } else {
                console.error("Error inesperado buscando deal en HubSpot:", e.message);
                throw new Error(`Error inesperado buscando deal: ${e.message}`);
            }
        }
    }

    /**
     * Obtiene un deal específico de HubSpot por su ID.
     * @param id El ID del deal.
     * @param userAccessToken Token de acceso del usuario.
     * @param propertiesToRequest Propiedades opcionales a solicitar.
     * @returns Promise con los datos del deal.
     */
    async getDeal(id: string, userAccessToken: string, propertiesToRequest: string[] = ["dealname", "dealstage", "pipeline", "amount", "closedate", "dealtype"]): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Obteniendo deal ID: ${id} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para getDeal");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            // Usar userClient
            const response = await userClient.crm.deals.basicApi.getById(id, propertiesToRequest);
            console.log(`Servicio HubSpot: Deal ${id} obtenido.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual, incluyendo 404)
            if (e.response) {
                console.error(`Error obteniendo deal ${id} (API):`, e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) obteniendo deal ${id}: ${message}`);
            } else {
                console.error(`Error inesperado obteniendo deal ${id}:`, e.message);
                throw new Error(`Error inesperado obteniendo deal ${id}: ${e.message}`);
            }
        }
    }

    /**
     * Crea un nuevo deal en HubSpot.
     * @param properties Propiedades del deal.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async createDeal(properties: DealProperties, userAccessToken: string): Promise<any> {
        console.log(`Servicio HubSpot: Creando deal ${properties.dealname} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido.");
        if (!properties.dealname || !properties.dealstage) {
            throw new Error("'dealname' y 'dealstage' son requeridos.");
        }
        // _getUserDealStageMap ya usa el token, no necesitamos cliente aquí aún
        let stageId: string;
        try {
            const userStageMap = await this._getUserDealStageMap(userAccessToken);
            const stageNameLower = properties.dealstage.toLowerCase();
            stageId = userStageMap[stageNameLower];
            if (!stageId) {
                console.error(`Etapa inválida/no encontrada: '${properties.dealstage}'. Etapas:`, Object.keys(userStageMap));
                throw new Error(`Etapa inválida: '${properties.dealstage}'.`);
            }
            console.log(`Etapa '${stageNameLower}' mapeada a ID '${stageId}'`);
        } catch (mapError: any) {
            throw mapError;
        }

        try {
            const propertiesToSend: { [key: string]: string } = {};
            for (const key in properties) {
                if (key !== 'dealstage' && Object.prototype.hasOwnProperty.call(properties, key) && properties[key as keyof DealProperties] !== undefined) {
                    propertiesToSend[key] = String(properties[key as keyof DealProperties]);
                }
            }
            propertiesToSend['dealstage'] = stageId;
            const dealInput: DealInput = { properties: propertiesToSend };

            // CORRECCIÓN: Usar userClient para la creación
            const userClient = new Client({ accessToken: userAccessToken });
            const response = await userClient.crm.deals.basicApi.create(dealInput);
            console.log(`Servicio HubSpot: Deal creado ID: ${response.id}`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual)
            if (e.response) {
                console.error("Error creando deal en HubSpot (API):", e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) creando deal: ${message}`);
            } else {
                console.error("Error inesperado creando deal en HubSpot:", e.message);
                throw new Error(`Error inesperado creando deal: ${e.message}`);
            }
        }
    }

    /**
     * Actualiza un deal existente en HubSpot.
     * @param identifier ID o nombre del deal.
     * @param properties Propiedades a actualizar.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async updateDeal(identifier: string, properties: Partial<DealProperties>, userAccessToken: string): Promise<any> {
        console.log(`Servicio HubSpot: Actualizando deal ${identifier} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para updateDeal"); // Requerido siempre por si buscamos ID o mapeamos etapa

        let dealId = identifier;
        const userClient = new Client({ accessToken: userAccessToken }); // Cliente para operaciones de este usuario

        // 1. Resolver ID si se proporcionó un nombre
        if (isNaN(Number(identifier))) {
            console.log(`Identificador '${identifier}' no numérico, buscando ID...`);
            try {
                // Usar userClient para buscar el deal del usuario
                const searchResult = await this.findDeal(identifier, userAccessToken);
                if (searchResult.total === 1) {
                    dealId = searchResult.results[0].id;
                    console.log(`ID encontrado para '${identifier}': ${dealId}`);
                } else if (searchResult.total > 1) {
                    const matchingNames = searchResult.results.map((r: any) => `'${r.properties.dealname}' (ID: ${r.id})`).join(', ');
                    throw new Error(`Múltiples deals encontrados para '${identifier}' (${matchingNames}). Proporciona ID exacto.`);
                } else {
                    throw new Error(`No se encontró deal con nombre '${identifier}'.`);
                }
            } catch (searchError: any) {
                console.error(`Error buscando deal '${identifier}' para actualizar: ${searchError.message}`);
                throw searchError;
            }
        }
        console.log(`Servicio HubSpot: Actualizando deal ID: ${dealId}`);

        // 2. Preparar propiedades y mapear etapa si es necesario
        const propertiesToSend: { [key: string]: string } = {};
        let stageName: string | undefined = undefined;
        for (const key in properties) {
            if (Object.prototype.hasOwnProperty.call(properties, key) && properties[key as keyof DealProperties] !== undefined) {
                if (key === 'dealstage') {
                    stageName = String(properties.dealstage).toLowerCase();
                } else {
                    propertiesToSend[key] = String(properties[key as keyof DealProperties]);
                }
            }
        }
        if (stageName) {
            try {
                const userStageMap = await this._getUserDealStageMap(userAccessToken);
                const stageId = userStageMap[stageName];
                if (!stageId) {
                    console.error(`Etapa inválida/no encontrada al actualizar: '${stageName}'. Etapas:`, Object.keys(userStageMap));
                    throw new Error(`Etapa inválida al actualizar: '${properties.dealstage}'.`);
                }
                propertiesToSend['dealstage'] = stageId;
                console.log(`Etapa actualización '${stageName}' mapeada a ID '${stageId}'`);
            } catch (mapError: any) {
                throw mapError;
            }
        }
        if (Object.keys(propertiesToSend).length === 0) {
            throw new Error("No se proporcionaron propiedades válidas para actualizar.");
        }

        // 3. Llamar a la API de actualización
        try {
            const dealInput: DealInput = { properties: propertiesToSend };
            // Usar userClient para la actualización
            const response = await userClient.crm.deals.basicApi.update(dealId, dealInput);
            console.log(`Servicio HubSpot: Deal ${dealId} actualizado.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual, incluyendo 404)
            if (e.response) {
                console.error(`Error actualizando deal ${dealId} (API):`, e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) actualizando deal ${dealId}: ${message}`);
            } else {
                console.error(`Error inesperado actualizando deal ${dealId}:`, e.message);
                throw new Error(`Error inesperado actualizando deal ${dealId}: ${e.message}`);
            }
        }
    }

    // --- Métodos para Tickets ---

    /**
     * Busca tickets en HubSpot.
     * @param searchTerm Término de búsqueda.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async findTicket(searchTerm: string, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Buscando ticket '${searchTerm}' (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para findTicket");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const searchRequest: TicketSearchRequest = {
                query: searchTerm,
                filterGroups: [],
                properties: ["subject", "content", "hs_pipeline", "hs_pipeline_stage", "hs_ticket_priority", "hubspot_owner_id", "hs_object_id"],
                limit: 10,
                after: "0"
            };
            // Usar userClient
            const response = await userClient.crm.tickets.searchApi.doSearch(searchRequest);
            console.log(`Servicio HubSpot: Búsqueda ticket encontró ${response.total} resultados.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual)
            if (e.response) {
                console.error("Error buscando ticket en HubSpot (API):", e.response.body);
                throw new Error(`Error API HubSpot buscando ticket: ${e.response.body?.message || e.message}`);
            } else {
                console.error("Error inesperado buscando ticket en HubSpot:", e.message);
                throw new Error(`Error inesperado buscando ticket: ${e.message}`);
            }
        }
    }

    /**
     * Obtiene un ticket específico de HubSpot por su ID.
     * @param id El ID del ticket.
     * @param userAccessToken Token de acceso del usuario.
     * @param propertiesToRequest Propiedades opcionales a solicitar.
     * @returns Promise con los datos del ticket.
     */
    async getTicket(id: string, userAccessToken: string, propertiesToRequest: string[] = ["subject", "content", "hs_pipeline", "hs_pipeline_stage", "hs_ticket_priority", "hubspot_owner_id"]): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Obteniendo ticket ID: ${id} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para getTicket");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            // Usar userClient
            const response = await userClient.crm.tickets.basicApi.getById(id, propertiesToRequest);
            console.log(`Servicio HubSpot: Ticket ${id} obtenido.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual, incluyendo 404)
            if (e.response) {
                console.error(`Error obteniendo ticket ${id} (API):`, e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) obteniendo ticket ${id}: ${message}`);
            } else {
                console.error(`Error inesperado obteniendo ticket ${id}:`, e.message);
                throw new Error(`Error inesperado obteniendo ticket ${id}: ${e.message}`);
            }
        }
    }

    /**
     * Crea un nuevo ticket en HubSpot.
     * @param properties Propiedades del ticket.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async createTicket(properties: TicketProperties, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Creando ticket ${properties.subject} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para createTicket");
        if (!properties.subject || !properties.content) {
            throw new Error("'subject' y 'content' son recomendados.");
        }
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const propertiesToSend: { [key: string]: string } = {};
            for (const key in properties) {
                if (Object.prototype.hasOwnProperty.call(properties, key) && properties[key as keyof TicketProperties] !== undefined) {
                    propertiesToSend[key] = String(properties[key as keyof TicketProperties]);
                }
            }
            const ticketInput: TicketInput = { properties: propertiesToSend };
            // Usar userClient
            const response = await userClient.crm.tickets.basicApi.create(ticketInput);
            console.log(`Servicio HubSpot: Ticket creado ID: ${response.id}`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual)
            if (e.response) {
                console.error("Error creando ticket en HubSpot (API):", e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) creando ticket: ${message}`);
            } else {
                console.error("Error inesperado creando ticket en HubSpot:", e.message);
                throw new Error(`Error inesperado creando ticket: ${e.message}`);
            }
        }
    }

    /**
     * Actualiza un ticket existente en HubSpot.
     * @param id El ID del ticket.
     * @param properties Propiedades a actualizar.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise con la respuesta de la API.
     */
    async updateTicket(id: string, properties: Partial<TicketProperties>, userAccessToken: string): Promise<any> { // Añadir userAccessToken
        console.log(`Servicio HubSpot: Actualizando ticket ID: ${id} (usuario token oculto)`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para updateTicket");
        const userClient = new Client({ accessToken: userAccessToken }); // Crear cliente temporal
        try {
            const propertiesToSend: { [key: string]: string } = {};
            for (const key in properties) {
                if (Object.prototype.hasOwnProperty.call(properties, key) && properties[key as keyof TicketProperties] !== undefined) {
                    propertiesToSend[key] = String(properties[key as keyof TicketProperties]);
                }
            }
            if (Object.keys(propertiesToSend).length === 0) {
                throw new Error("No se proporcionaron propiedades para actualizar.");
            }
            const ticketInput: TicketInput = { properties: propertiesToSend };
            // Usar userClient
            const response = await userClient.crm.tickets.basicApi.update(id, ticketInput);
            console.log(`Servicio HubSpot: Ticket ${id} actualizado.`);
            return response;
        } catch (e: any) {
            // ... (Manejo de error igual, incluyendo 404)
            if (e.response) {
                console.error(`Error actualizando ticket ${id} (API):`, e.response.body);
                const message = e.response.body?.message || e.message;
                const status = e.response.statusCode;
                throw new Error(`Error API HubSpot (${status}) actualizando ticket ${id}: ${message}`);
            } else {
                console.error(`Error inesperado actualizando ticket ${id}:`, e.message);
                throw new Error(`Error inesperado actualizando ticket ${id}: ${e.message}`);
            }
        }
    }

    // --- Fin Métodos para Tickets ---

    // --- Métodos para Tareas ---

    /**
     * Mapea el estado de la tarea local al estado esperado por HubSpot.
     * @param localStatus Estado de la tarea ('pending', 'completed', 'overdue').
     * @returns Estado de HubSpot ('NOT_STARTED', 'COMPLETED', 'WAITING', 'IN_PROGRESS', 'DEFERRED').
     * @private
     */
    private _mapTaskStatus(localStatus: 'pending' | 'completed' | 'overdue'): 'NOT_STARTED' | 'COMPLETED' | 'WAITING' | 'IN_PROGRESS' | 'DEFERRED' {
        switch (localStatus) {
            case 'completed':
                return 'COMPLETED';
            case 'pending':
            case 'overdue':
            default:
                // Podríamos mapear 'overdue' a 'WAITING' o 'DEFERRED' si tuviera sentido
                return 'NOT_STARTED';
        }
    }

    /**
     * Mapea la prioridad de la tarea local a la esperada por HubSpot.
     * @param localPriority Prioridad ('low', 'medium', 'high').
     * @returns Prioridad de HubSpot ('LOW', 'MEDIUM', 'HIGH').
     * @private
     */
    private _mapTaskPriority(localPriority: 'low' | 'medium' | 'high'): 'LOW' | 'MEDIUM' | 'HIGH' {
        return localPriority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH';
    }

    /**
     * Convierte una fecha/hora ISO o local a timestamp en milisegundos para HubSpot.
     * @param dateTimeString String de fecha/hora (puede ser YYYY-MM-DDTHH:mm).
     * @returns Timestamp en milisegundos UTC, o null si la fecha no es válida.
     * @private
     */
    private _getHubspotTimestamp(dateTimeString: string): number | null {
        try {
            // Intentar parsear la fecha. Date.parse devuelve NaN si no es válido.
            const timestamp = Date.parse(dateTimeString);
            if (isNaN(timestamp)) {
                console.warn(`[HubSpotService] Fecha/hora inválida para timestamp: ${dateTimeString}`);
                return null;
            }
            // HubSpot espera timestamp en milisegundos UTC
            return timestamp;
        } catch (e) {
            console.error(`[HubSpotService] Error convirtiendo fecha a timestamp: ${dateTimeString}`, e);
            return null;
        }
    }

    /**
     * Asocia una tarea de HubSpot con otro objeto (Contacto, Deal, etc.) usando la API V3.
     * @param hubspotTaskId ID de la tarea en HubSpot.
     * @param targetObjectType Tipo del objeto destino ('contact', 'deal', 'company', 'ticket').
     * @param targetObjectId ID del objeto destino en HubSpot.
     * @param userAccessToken Token de acceso del usuario.
     * @private
     */
    private async _associateTaskToObject(hubspotTaskId: string, targetObjectType: string, targetObjectId: string, userAccessToken: string): Promise<void> {
        console.log(`[HubSpotService] Asociando Tarea ${hubspotTaskId} con ${targetObjectType} ${targetObjectId}`);
        if (!hubspotTaskId || !targetObjectType || !targetObjectId) {
            console.warn("[HubSpotService] Faltan IDs para la asociación de tarea.");
            return;
        }

        // Construir la URL completa
        const associationUrl = `https://api.hubapi.com/crm/v3/associations/task/${targetObjectType}/batch/create`;
        const associationType = `task_to_${targetObjectType}`;

        const payload = {
            inputs: [
                {
                    "from": { "id": hubspotTaskId },
                    "to": { "id": targetObjectId },
                    "type": associationType
                }
            ]
        };

        console.log(`[HubSpotService] Llamando a endpoint de asociación (con axios): ${associationUrl}`);
        console.log(`[HubSpotService] Payload de asociación:`, JSON.stringify(payload));

        // Reemplazar userClient.apiRequest con axios.post
        try {
            const response = await axios.post(associationUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${userAccessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            // Axios lanza error para status >= 300
            console.log(`[HubSpotService] Respuesta de asociación (${response.status}):`, response.data);
            console.log(`[HubSpotService] Asociación exitosa: Tarea ${hubspotTaskId} -> ${targetObjectType} ${targetObjectId}`);
        } catch (error: any) {
            const status = error.response?.status || 'UNKNOWN';
            const data = error.response?.data;
            const errorMessage = data?.message || error.message || 'Error desconocido';
            console.error(`[HubSpotService] Error en la API de asociación (Status ${status}) para Tarea ${hubspotTaskId} -> ${targetObjectType} ${targetObjectId}:`, data || error);
            // Propagar el error
            throw new Error(`Error API HubSpot (${status}) asociando tarea: ${errorMessage}`);
        } // Fin del bloque try-catch para axios
    }

    /**
     * Sincroniza (crea o actualiza) una tarea en HubSpot y la asocia al objeto especificado.
     * @param taskData Datos de la tarea desde nuestra aplicación.
     * @param hubspotObjectId ID del objeto HubSpot al que asociar la tarea (Contacto, Deal, etc.).
     * @param hubspotObjectType Tipo del objeto HubSpot al que asociar ('contact', 'deal', 'company', 'ticket').
     * @param userAccessToken Token de acceso del usuario.
     * @param existingHubspotTaskId (Opcional) ID de la tarea en HubSpot si ya existe.
     * @returns Promise con el ID de la tarea en HubSpot (creada o actualizada).
     */
    async syncTask(
        taskData: { title: string; status: 'pending' | 'completed' | 'overdue'; priority: 'low' | 'medium' | 'high'; time: string },
        hubspotObjectId: string,
        hubspotObjectType: 'contact' | 'deal' | 'company' | 'ticket',
        userAccessToken: string,
        existingHubspotTaskId?: string | null
    ): Promise<string> {
        console.log(`[HubSpotService] Iniciando syncTask para '${taskData.title}'. Objeto: ${hubspotObjectType} ${hubspotObjectId}. Tarea HS existente: ${existingHubspotTaskId}`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para syncTask");
        if (!hubspotObjectId || !hubspotObjectType) throw new Error("HubSpot Object ID y Type son requeridos para asociar la tarea");

        const userClient = new Client({ accessToken: userAccessToken });

        // 1. Mapear propiedades - CORRECCIÓN: hs_timestamp debe ser string
        const properties: { [key: string]: string } = { // Asegurar que el tipo sea string:string
            hs_task_subject: taskData.title,
            hs_task_status: this._mapTaskStatus(taskData.status),
            hs_task_priority: this._mapTaskPriority(taskData.priority),
        };

        const timestamp = this._getHubspotTimestamp(taskData.time);
        if (timestamp) {
            properties.hs_timestamp = String(timestamp); // Convertir a string
        } else {
            properties.hs_task_body = `Programado para: ${taskData.time}`;
        }

        let hubspotTaskId = existingHubspotTaskId;

        try {
            // 2. Intentar Actualizar si existe ID
            if (hubspotTaskId) {
                console.log(`[HubSpotService] Intentando actualizar Tarea HS ${hubspotTaskId}`);
                // CORRECCIÓN: Asegurar que el payload coincida con SimplePublicObjectInput (properties string:string)
                const updatePayload: SimplePublicObjectInput = { properties };
                try {
                    await userClient.crm.objects.tasks.basicApi.update(hubspotTaskId, updatePayload);
                    console.log(`[HubSpotService] Tarea HS ${hubspotTaskId} actualizada.`);
                } catch (e: any) {
                    // ... (manejo de 404 igual) ...
                    if (e.response?.statusCode === 404) {
                        console.log(`[HubSpotService] Tarea HS ${hubspotTaskId} no encontrada, se creará una nueva.`);
                        hubspotTaskId = null; // Forzar creación
                    } else {
                        const statusCode = e.response?.statusCode || 'UNKNOWN';
                        const responseBody = e.response?.body || e.message;
                        console.error(`[HubSpotService] Error actualizando Tarea HS ${hubspotTaskId} (Status ${statusCode}):`, responseBody);
                        throw new Error(`Error API HubSpot (${statusCode}) actualizando tarea: ${responseBody?.message || JSON.stringify(responseBody)}`);
                    }
                }
            }

            // 3. Crear si no había ID o la actualización falló con 404
            if (!hubspotTaskId) {
                console.log(`[HubSpotService] Creando nueva tarea HS para '${taskData.title}'`);
                // CORRECCIÓN: Usar SimplePublicObjectInput y extenderlo para incluir associations
                const createPayload: SimplePublicObjectInput & { associations?: any[] } = {
                    properties,
                    associations: [] // Requerido por la API de creación
                };
                const createResponse = await userClient.crm.objects.tasks.basicApi.create(createPayload as any); // Usar 'as any' temporalmente si TS se queja de 'associations'
                hubspotTaskId = createResponse.id;
                console.log(`[HubSpotService] Nueva tarea HS creada con ID: ${hubspotTaskId}`);
            }

            // 4. Asociar la tarea (recién creada o la existente) con el objeto principal
            if (hubspotTaskId) {
                await this._associateTaskToObject(hubspotTaskId, hubspotObjectType, hubspotObjectId, userAccessToken);
            } else {
                // Esto no debería pasar si la creación fue exitosa, pero por si acaso
                console.error("[HubSpotService] No se obtuvo un hubspotTaskId después de crear/actualizar.");
                throw new Error("No se pudo obtener el ID de la tarea de HubSpot después de la operación.");
            }

            // 5. Devolver el ID de HubSpot de la tarea
            return hubspotTaskId;

        } catch (e: any) {
            // Capturar errores de creación/actualización/asociación
            console.error(`[HubSpotService] Error durante syncTask para '${taskData.title}':`, e.message);
            // Propagar el error para que la ruta lo maneje
            throw e;
        }
    }

    /**
     * Elimina una tarea específica de HubSpot por su ID.
     * @param hubspotTaskId El ID de la tarea en HubSpot.
     * @param userAccessToken Token de acceso del usuario.
     * @returns Promise que se resuelve si la eliminación fue exitosa (o si la tarea no existía).
     */
    async deleteHubspotTask(hubspotTaskId: string, userAccessToken: string): Promise<void> {
        console.log(`[HubSpotService] Intentando eliminar Tarea HS ${hubspotTaskId}`);
        if (!hubspotTaskId) {
            console.warn("[HubSpotService] No se proporcionó hubspotTaskId para eliminar.");
            return; // No hacer nada si no hay ID
        }
        if (!userAccessToken) throw new Error("userAccessToken es requerido para deleteHubspotTask");

        const userClient = new Client({ accessToken: userAccessToken });

        try {
            // Llamar a la API para eliminar la tarea
            await userClient.crm.objects.tasks.basicApi.archive(hubspotTaskId);
            console.log(`[HubSpotService] Tarea HS ${hubspotTaskId} eliminada (archivada) exitosamente.`);
        } catch (e: any) {
            const status = e.response?.statusCode || e.code || 'UNKNOWN';
            const responseBody = e.response?.body || e.message;

            // Si el error es 404 (Not Found), consideramos la operación exitosa
            // porque la tarea ya no existe en HubSpot.
            if (status === 404) {
                console.log(`[HubSpotService] Tarea HS ${hubspotTaskId} no encontrada en HubSpot (código 404). Se considera eliminada.`);
                return; // Éxito
            }

            // Para otros errores, los registramos y lanzamos
            console.error(`[HubSpotService] Error eliminando Tarea HS ${hubspotTaskId} (Status ${status}):`, responseBody);
            throw new Error(`Error API HubSpot (${status}) eliminando tarea: ${responseBody?.message || JSON.stringify(responseBody)}`);
        }
    }

} // Fin de la clase HubSpotService

// Exportar una instancia singleton si prefieres ese patrón, o simplemente la clase
// export const hubspotService = new HubSpotService(); 