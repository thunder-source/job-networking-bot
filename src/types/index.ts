// Base types and interfaces for the job networking bot

export interface IContact {
    _id?: string;
    name: string;
    email: string;
    linkedinUrl?: string;
    company?: string;
    position?: string;
    status: ContactStatus;
    lastContactDate: Date;
    conversationHistory: IConversationHistory[];
    notes?: string;
    tags: string[];
    source: ContactSource;
    phone?: string;
    location?: ILocation;
    industry?: string;
    experience?: ExperienceLevel;
    priority: Priority;
    campaigns?: string[];
    responseRate: number;
    lastResponseDate?: Date;
    emailLookup?: IEmailLookupData;
    createdAt: Date;
    updatedAt: Date;
}

export interface IConversationHistory {
    _id?: string;
    date: Date;
    type: ConversationType;
    content: string;
    direction: ConversationDirection;
    subject?: string;
    attachments?: string[];
}

export interface ILocation {
    city?: string;
    state?: string;
    country?: string;
}

export interface IEmailLookupData {
    foundEmail?: string;
    confidence?: number;
    source?: 'hunter' | 'rocketreach' | 'fallback' | 'cache' | 'manual' | 'unknown';
    method?: 'api' | 'pattern' | 'database' | 'manual' | 'none';
    verified?: boolean;
    lastVerified?: Date;
    verificationMethod?: string;
    lookupMetadata?: Record<string, any>;
}

export interface ITemplate {
    _id?: string;
    name: string;
    type: TemplateType;
    content: string;
    variables: ITemplateVariable[];
    subject?: string;
    description?: string;
    category: TemplateCategory;
    isActive: boolean;
    isPublic: boolean;
    usageCount: number;
    lastUsed?: Date;
    version: number;
    previousVersions: ITemplateVersion[];
    settings: ITemplateSettings;
    tags: string[];
    author?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITemplateVariable {
    _id?: string;
    name: string;
    description?: string;
    type: VariableType;
    required: boolean;
    defaultValue?: any;
    validation?: IVariableValidation;
}

export interface ITemplateVersion {
    content: string;
    variables: ITemplateVariable[];
    createdAt: Date;
}

export interface ITemplateSettings {
    maxLength?: number;
    minLength?: number;
    allowHtml: boolean;
    allowMarkdown: boolean;
}

export interface IVariableValidation {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
}

export interface ICampaign {
    _id?: string;
    name: string;
    description?: string;
    targetCriteria: ITargetCriteria;
    status: CampaignStatus;
    startDate: Date;
    endDate?: Date;
    stats: ICampaignStats;
    settings: ICampaignSettings;
    contacts: string[];
    templates: ICampaignTemplate[];
    schedule: ICampaignSchedule;
    results: ICampaignResult[];
    tags: string[];
    author?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITargetCriteria {
    locations?: ILocationCriteria[];
    industries?: string[];
    companies?: string[];
    companySize?: ICompanySize;
    positions?: string[];
    experienceLevel?: ExperienceLevel;
    requiredSkills?: string[];
    preferredSkills?: string[];
    contactSources?: ContactSource[];
    hasResponded?: boolean;
    lastContactDays?: ILastContactDays;
    customFilters?: ICustomFilter[];
}

export interface ILocationCriteria {
    city?: string;
    state?: string;
    country?: string;
    radius?: number;
}

export interface ICompanySize {
    min: number;
    max: number;
}

export interface ILastContactDays {
    min: number;
    max: number;
}

export interface ICustomFilter {
    field: string;
    operator: FilterOperator;
    value: any;
}

export interface ICampaignStats {
    totalContacts: number;
    contactsProcessed: number;
    contactsPending: number;
    messagesSent: number;
    emailsSent: number;
    linkedinMessagesSent: number;
    responsesReceived: number;
    positiveResponses: number;
    negativeResponses: number;
    connections: number;
    meetings: number;
    applications: number;
    responseRate: number;
    connectionRate: number;
    meetingRate: number;
    applicationRate: number;
}

export interface ICampaignSettings {
    maxMessagesPerDay: number;
    maxMessagesPerHour: number;
    delayBetweenMessages: number;
    personalizeMessages: boolean;
    followUpEnabled: boolean;
    followUpDelay: number;
    maxFollowUps: number;
    defaultTemplate?: string;
    followUpTemplate?: string;
}

export interface ICampaignTemplate {
    template: string;
    usageCount: number;
}

export interface ICampaignSchedule {
    enabled: boolean;
    timezone: string;
    workingHours: IWorkingHours;
    blackoutDates: Date[];
}

export interface IWorkingHours {
    start: string;
    end: string;
    days: DayOfWeek[];
}

export interface ICampaignResult {
    date: Date;
    action: CampaignAction;
    contactId: string;
    details?: string;
    metadata?: any;
}

export interface IDatabaseConnection {
    connection: any;
    retryCount: number;
    maxRetries: number;
    retryDelay: number;
    connect(): Promise<any>;
    disconnect(): Promise<void>;
    healthCheck(): Promise<IHealthCheck>;
    getConnectionStatus(): string;
}

export interface IHealthCheck {
    status: 'healthy' | 'unhealthy';
    message: string;
}

export interface IDatabaseService {
    isConnected: boolean;
    initialize(): Promise<void>;
    healthCheck(): Promise<IHealthCheck>;
    createContact(contactData: Partial<IContact>): Promise<IContact>;
    getContacts(filter?: any): Promise<IContact[]>;
    getContactById(id: string): Promise<IContact | null>;
    updateContact(id: string, updateData: Partial<IContact>): Promise<IContact | null>;
    deleteContact(id: string): Promise<void>;
    createTemplate(templateData: Partial<ITemplate>): Promise<ITemplate>;
    getTemplates(filter?: any): Promise<ITemplate[]>;
    getTemplateById(id: string): Promise<ITemplate | null>;
    updateTemplate(id: string, updateData: Partial<ITemplate>): Promise<ITemplate | null>;
    deleteTemplate(id: string): Promise<void>;
    createCampaign(campaignData: Partial<ICampaign>): Promise<ICampaign>;
    getCampaigns(filter?: any): Promise<ICampaign[]>;
    getCampaignById(id: string): Promise<ICampaign | null>;
    updateCampaign(id: string, updateData: Partial<ICampaign>): Promise<ICampaign | null>;
    deleteCampaign(id: string): Promise<void>;
    getContactStats(): Promise<any[]>;
    getCampaignStats(): Promise<any[]>;
    getTemplateStats(): Promise<any[]>;
    searchContacts(query: string): Promise<IContact[]>;
    searchTemplates(query: string): Promise<ITemplate[]>;
    cleanup(): Promise<void>;
}

// Enums
export enum ContactStatus {
    PENDING = 'pending',
    CONNECTED = 'connected',
    RESPONDED = 'responded',
    NOT_INTERESTED = 'not_interested',
    BLOCKED = 'blocked'
}

export enum ContactSource {
    LINKEDIN = 'linkedin',
    EMAIL = 'email',
    REFERRAL = 'referral',
    EVENT = 'event',
    OTHER = 'other'
}

export enum ConversationType {
    EMAIL = 'email',
    LINKEDIN_MESSAGE = 'linkedin_message',
    PHONE = 'phone',
    MEETING = 'meeting',
    OTHER = 'other'
}

export enum ConversationDirection {
    SENT = 'sent',
    RECEIVED = 'received'
}

export enum ExperienceLevel {
    ENTRY = 'entry',
    MID = 'mid',
    SENIOR = 'senior',
    EXECUTIVE = 'executive',
    ANY = 'any'
}

export enum Priority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high'
}

export enum TemplateType {
    CONNECTION = 'connection',
    FOLLOWUP = 'followup',
    THANKYOU = 'thankyou',
    INTRODUCTION = 'introduction',
    FOLLOW_UP = 'follow_up',
    REJECTION_FOLLOWUP = 'rejection_followup',
    MEETING_REQUEST = 'meeting_request',
    REFERRAL_REQUEST = 'referral_request'
}

export enum TemplateCategory {
    NETWORKING = 'networking',
    JOB_APPLICATION = 'job_application',
    FOLLOW_UP = 'follow_up',
    THANK_YOU = 'thank_you',
    INTRODUCTION = 'introduction',
    OTHER = 'other'
}

export enum VariableType {
    STRING = 'string',
    NUMBER = 'number',
    DATE = 'date',
    BOOLEAN = 'boolean',
    ARRAY = 'array'
}

export enum CampaignStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export enum FilterOperator {
    EQUALS = 'equals',
    CONTAINS = 'contains',
    STARTS_WITH = 'startsWith',
    ENDS_WITH = 'endsWith',
    GREATER_THAN = 'greaterThan',
    LESS_THAN = 'lessThan',
    BETWEEN = 'between'
}

export enum DayOfWeek {
    MONDAY = 'monday',
    TUESDAY = 'tuesday',
    WEDNESDAY = 'wednesday',
    THURSDAY = 'thursday',
    FRIDAY = 'friday',
    SATURDAY = 'saturday',
    SUNDAY = 'sunday'
}

export enum CampaignAction {
    MESSAGE_SENT = 'message_sent',
    RESPONSE_RECEIVED = 'response_received',
    CONNECTION_MADE = 'connection_made',
    MEETING_SCHEDULED = 'meeting_scheduled',
    APPLICATION_SUBMITTED = 'application_submitted'
}

// Utility types
export type CreateContactData = Omit<IContact, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateContactData = Partial<Omit<IContact, '_id' | 'createdAt' | 'updatedAt'>>;
export type CreateTemplateData = Omit<ITemplate, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateTemplateData = Partial<Omit<ITemplate, '_id' | 'createdAt' | 'updatedAt'>>;
export type CreateCampaignData = Omit<ICampaign, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateCampaignData = Partial<Omit<ICampaign, '_id' | 'createdAt' | 'updatedAt'>>;
