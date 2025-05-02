import { Client } from '@hubspot/api-client';
import axios from 'axios'; // <-- Importar axios
// Importaremos más tipos específicos de HubSpot a medida que los necesitemos
import { SimplePublicObjectInput } from '@hubspot/api-client/lib/codegen/crm/contacts'; // Ejemplo para crear contacto
import { PublicObjectSearchRequest } from '@hubspot/api-client/lib/codegen/crm/contacts'; // Para la búsqueda
import { CollectionResponseSimplePublicObjectWithAssociationsForwardPaging } from '@hubspot/api-client/lib/codegen/crm/objects/tasks'; // <-- Usar tipo sin 'WithTotal'

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
        // Mapeo lógico de estados locales a estados de HubSpot
        switch (localStatus) {
            case 'completed':
                return 'COMPLETED';
            case 'pending':
            case 'overdue': // Tratar 'overdue' como 'NOT_STARTED' ya que no hay estado directo en HS
            default:
                return 'NOT_STARTED';
            // Podrías añadir lógica para otros estados de HubSpot si tu app los maneja
            // case 'in_progress': return 'IN_PROGRESS';
            // case 'waiting': return 'WAITING';
            // case 'deferred': return 'DEFERRED';
        }
    }

    /**
     * Mapea la prioridad de la tarea local a la esperada por HubSpot.
     * @param localPriority Prioridad ('low', 'medium', 'high').
     * @returns Prioridad de HubSpot ('LOW', 'MEDIUM', 'HIGH').
     * @private
     */
    private _mapTaskPriority(localPriority: 'low' | 'medium' | 'high'): 'LOW' | 'MEDIUM' | 'HIGH' {
        // Mapeo de prioridades locales a prioridades de HubSpot
        switch (localPriority) {
            case 'low':
                return 'LOW';
            case 'high':
                return 'HIGH';
            case 'medium':
            default:
                return 'MEDIUM';
        }
    }

    /**
     * Convierte una fecha/hora ISO o local a timestamp en milisegundos para HubSpot.
     * @param dateTimeString String de fecha/hora (puede ser YYYY-MM-DDTHH:mm).
     * @returns Timestamp en milisegundos UTC, o null si la fecha no es válida.
     * @private
     */
    private _getHubspotTimestamp(dateTimeString: string): number | null {
        try {
            // Interpretar el string YYYY-MM-DDTHH:mm como hora local del servidor
            // y obtener el timestamp UTC en milisegundos.
            const date = new Date(dateTimeString);
            if (isNaN(date.getTime())) {
                console.warn(`[HubSpotService] Fecha/hora inválida proporcionada a _getHubspotTimestamp: ${dateTimeString}`);
                return null;
            }
            // HubSpot espera timestamp en milisegundos UTC
            return date.getTime();
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
     * Sincroniza (crea o actualiza) una tarea local con HubSpot.
     * Mapea estado y prioridad locales a los valores de HubSpot.
     */
    async syncTask(
        taskData: { title: string; status: 'pending' | 'completed' | 'overdue'; priority: 'low' | 'medium' | 'high'; time: string },
        hubspotObjectId: string,
        hubspotObjectType: 'contact' | 'deal' | 'company' | 'ticket',
        userAccessToken: string,
        existingHubspotTaskId?: string | null
    ): Promise<string> {
        console.log(`Servicio HubSpot: Sincronizando tarea "${taskData.title}" con ${hubspotObjectType} ID ${hubspotObjectId}`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para syncTask");
        const userClient = new Client({ accessToken: userAccessToken });

        // Preparar propiedades comunes mapeando estado y prioridad
        const taskProperties: { [key: string]: string | number | undefined } = {
            hs_task_subject: taskData.title,
            hs_task_status: this._mapTaskStatus(taskData.status), // <-- Usar mapeo
            hs_task_priority: this._mapTaskPriority(taskData.priority), // <-- Usar mapeo
            hs_timestamp: this._getHubspotTimestamp(taskData.time)?.toString() // Convertir a string si no es null
            // hs_task_body: taskData.details || '', // Añadir si tienes detalles/cuerpo
            // hubspot_owner_id: taskData.ownerId || undefined // Añadir si manejas owner
        };

        // Eliminar propiedades undefined para evitar errores con la API
        Object.keys(taskProperties).forEach(key => taskProperties[key] === undefined && delete taskProperties[key]);

        try {
            let hubspotTaskId: string;

            if (existingHubspotTaskId) {
                // --- Actualizar Tarea Existente ---
                console.log(`Actualizando tarea existente en HubSpot ID: ${existingHubspotTaskId}`);
                const simplePublicObjectInput: SimplePublicObjectInput = { properties: taskProperties as { [key: string]: string } };

                try {
                    // Corrección: Usar la API genérica de objetos especificando 'tasks'
                    const updateResponse = await userClient.crm.objects.basicApi.update(
                        'tasks', // <--- Especificar tipo de objeto
                        existingHubspotTaskId,
                        simplePublicObjectInput
                    );
                    hubspotTaskId = updateResponse.id;
                    console.log(`Tarea HubSpot ID: ${hubspotTaskId} actualizada.`);
                } catch (updateError: any) {
                    if (updateError.response?.statusCode === 404) {
                        console.warn(`Tarea HS ${existingHubspotTaskId} no encontrada para actualizar. Se procederá a crear una nueva.`);
                        existingHubspotTaskId = null; // Limpiar el ID para forzar la creación
                    } else {
                        console.error("Error al actualizar tarea en HubSpot:", updateError.response?.body || updateError.message);
                        throw updateError; // Relanzar otros errores
                    }
                }
            }

            // Si no había ID existente o la actualización falló con 404, crear nueva tarea
            if (!existingHubspotTaskId) {
                // --- Crear Nueva Tarea ---
                console.log("Creando nueva tarea en HubSpot...");
                const createPayload = {
                    properties: taskProperties as { [key: string]: string },
                    associations: [] // Requerido por SimplePublicObjectInputForCreate
                };
                // Corrección: Usar la API genérica de objetos especificando 'tasks'
                const createResponse = await userClient.crm.objects.basicApi.create(
                    'tasks', // <--- Especificar tipo de objeto
                    createPayload
                );
                hubspotTaskId = createResponse.id;
                console.log(`Nueva tarea creada en HubSpot ID: ${hubspotTaskId}. Asociando...`);

                // Asociar la tarea recién creada al objeto principal
                await this._associateTaskToObject(hubspotTaskId, hubspotObjectType, hubspotObjectId, userAccessToken);
                console.log(`Tarea ${hubspotTaskId} asociada a ${hubspotObjectType} ${hubspotObjectId}.`);
            } else {
                // Si actualizamos con éxito, usamos el ID existente
                hubspotTaskId = existingHubspotTaskId;
            }

            return hubspotTaskId; // Devolver el ID de la tarea en HubSpot

        } catch (e: any) {
            // Corrección Linter: Asegurar que el error se relanza siempre
            if (e.response) {
                console.error("Error sincronizando tarea con HubSpot (API):", e.response.body);
                // Construir un nuevo error para relanzar
                throw new Error(`Error API HubSpot (${e.response.statusCode}) sincronizando tarea: ${e.response.body?.message || e.message}`);
            } else {
                console.error("Error inesperado sincronizando tarea con HubSpot:", e.message);
                // Relanzar el error original o uno nuevo
                throw new Error(`Error inesperado sincronizando tarea: ${e.message}`);
            }
            // No añadir un return aquí, el throw maneja el flujo
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

    /**
     * Obtiene todas las tareas asociadas a un usuario desde HubSpot usando la API v1 Engagements.
     * Maneja paginación y transforma la respuesta para simular la estructura v3.
     * @param userAccessToken Token de acceso del usuario.
     * @param propertiesToFetch (Ignorado por API v1, devuelve un conjunto fijo) Array de propiedades a solicitar para cada tarea.
     * @returns Promise con un array de todas las tareas encontradas, transformadas.
     */
    async getAllTasks(
        userAccessToken: string,
        propertiesToFetch: string[] = [] // Parámetro mantenido por compatibilidad, pero ignorado
    ): Promise<any[]> {
        console.log(`[HubSpotService] Obteniendo todas las tareas vía Engagements API v1...`);
        if (!userAccessToken) throw new Error("userAccessToken es requerido para getAllTasks");

        const allTasksTransformed: any[] = [];
        let offset: number | undefined = undefined;
        const limit = 100; // La API v1 permite hasta 250, pero 100 es seguro
        let hasMore = true;

        const engagementApiUrl = "https://api.hubapi.com/engagements/v1/engagements/paged";

        try {
            while (hasMore) {
                const params: { limit: number; offset?: number } = { limit };
                if (offset) {
                    params.offset = offset;
                }

                console.log(`[HubSpotService] Fetching engagements page with offset: ${offset || 0}`);
                let apiResponse: any;
                try {
                    // Usar axios para llamar a la API v1
                    const response = await axios.get(engagementApiUrl, {
                        headers: {
                            'Authorization': `Bearer ${userAccessToken}`,
                            'Accept': 'application/json'
                        },
                        params: params
                    });
                    apiResponse = response.data;
                } catch (fetchError: any) {
                    console.error(`[HubSpotService] Error fetching engagements page:`, fetchError.response?.data || fetchError.message);
                    throw new Error(`Error API HubSpot v1 obteniendo página de engagements: ${fetchError.response?.data?.message || fetchError.message}`);
                }

                if (apiResponse.results?.length > 0) {
                    const taskEngagements = apiResponse.results.filter((result: any) =>
                        result.engagement?.type === 'TASK' || result.engagement?.type === 'TODO'
                    );
                    console.log(`[HubSpotService] Filtrado: ${taskEngagements.length} engagements de tipo TASK/TODO encontrados en esta página.`);

                    const transformedResults = taskEngagements.map((result: any) => {
                        // <<< INICIO LOG ESTRUCTURA ORIGINAL V1 >>>
                        console.log(`[HubSpotService] RAW Engagement V1 Data (ID: ${result.engagement?.id}):`, JSON.stringify(result, null, 2));
                        // <<< FIN LOG ESTRUCTURA ORIGINAL V1 >>>

                        const engagement = result.engagement;
                        const associationsV1 = result.associations;
                        const metadata = result.metadata;

                        // Convertir hs_createdate a ISO string (fallback primario)
                        const hs_createdate_iso = engagement.createdAt ? new Date(engagement.createdAt).toISOString() : new Date(0).toISOString(); // Usar epoch si falta createdAt

                        // Convertir hs_timestamp (ms) a ISO string, manejar null/undefined
                        let hs_timestamp_iso: string | null = null;
                        if (engagement.timestamp && !isNaN(Number(engagement.timestamp))) {
                            try {
                                hs_timestamp_iso = new Date(Number(engagement.timestamp)).toISOString();
                            } catch (e) {
                                console.warn(`[HubSpotService] Error convirtiendo engagement.timestamp ${engagement.timestamp} a Date:`, e);
                                hs_timestamp_iso = null; // Fallback a null si hay error
                            }
                        } else if (engagement.timestamp) {
                            console.warn(`[HubSpotService] engagement.timestamp ${engagement.timestamp} no es un número válido.`);
                        }

                        // Mapear propiedades v1 a la estructura v3
                        const propertiesV3 = {
                            hs_createdate: hs_createdate_iso,
                            hs_lastmodifieddate: engagement.lastUpdated ? new Date(engagement.lastUpdated).toISOString() : null,
                            hs_object_id: engagement.id?.toString(),
                            hs_task_body: metadata?.body || engagement.bodyPreview || null,
                            hs_task_priority: metadata?.priority || 'NONE',
                            hs_task_status: metadata?.status || 'NOT_STARTED',
                            hs_task_subject: metadata?.subject || 'Tarea sin título',
                            hs_task_type: engagement.type || 'TODO',
                            hs_timestamp: hs_timestamp_iso, // Usar el ISO string convertido (puede ser null)
                            hubspot_owner_id: engagement.ownerId?.toString() || null
                        };

                        const associationsV3 = {
                            contacts: { results: (associationsV1?.contactIds || []).map((id: number) => ({ id: id.toString() })) },
                            companies: { results: (associationsV1?.companyIds || []).map((id: number) => ({ id: id.toString() })) },
                            deals: { results: (associationsV1?.dealIds || []).map((id: number) => ({ id: id.toString() })) },
                            tickets: { results: (associationsV1?.ticketIds || []).map((id: number) => ({ id: id.toString() })) }
                        };

                        return {
                            id: engagement.id?.toString(),
                            properties: propertiesV3,
                            associations: associationsV3,
                            createdAt: engagement.createdAt ? new Date(engagement.createdAt).toISOString() : null,
                            updatedAt: engagement.lastUpdated ? new Date(engagement.lastUpdated).toISOString() : null,
                            archived: engagement.active === false
                        };
                    });
                    allTasksTransformed.push(...transformedResults);
                }

                // Actualizar para la siguiente página
                hasMore = apiResponse.hasMore;
                offset = apiResponse.offset;

            } // Fin while(hasMore)

            console.log(`[HubSpotService] Total de ${allTasksTransformed.length} tareas obtenidas y transformadas desde Engagements API v1.`);
            return allTasksTransformed;

        } catch (e: any) {
            // Asegurarse de que el error se propaga correctamente
            const message = e.message.includes('obteniendo página de engagements') ? e.message : `[HubSpotService] Error general obteniendo tareas (Engagements API v1): ${e.message}`;
            console.error(message);
            throw new Error(message);
        }
    }

} // Fin de la clase HubSpotService
// Exportar una instancia singleton si prefieres ese patrón, o simplemente la clase
// export const hubspotService = new HubSpotService(); 
