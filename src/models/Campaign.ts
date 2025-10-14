import mongoose, { Document, Schema, Model } from 'mongoose';
import type {
  ICampaign,
  ITargetCriteria,
  ICampaignStats,
  ICampaignSettings,
  ICampaignTemplate,
  ICampaignSchedule,
  ICampaignResult,
  ILocationCriteria,
  ICompanySize,
  ILastContactDays,
  ICustomFilter,
  IWorkingHours
} from '../types/index.js';
import {
  CampaignStatus,
  FilterOperator,
  DayOfWeek,
  CampaignAction,
  ExperienceLevel,
  ContactSource
} from '../types/index.js';

// Interface for the document
export interface ICampaignDocument extends Omit<ICampaign, '_id'>, Document {
  duration: number | null;
  completionPercentage: number;
  healthScore: number;
  addContact(contactId: string): Promise<ICampaignDocument>;
  removeContact(contactId: string): Promise<ICampaignDocument>;
  recordMessage(type?: string): Promise<ICampaignDocument>;
  recordResponse(isPositive?: boolean): Promise<ICampaignDocument>;
  recordConnection(): Promise<ICampaignDocument>;
  recordMeeting(): Promise<ICampaignDocument>;
  recordApplication(): Promise<ICampaignDocument>;
  addResult(resultData: Partial<ICampaignResult>): Promise<ICampaignDocument>;
  updateStatus(newStatus: CampaignStatus): Promise<ICampaignDocument>;
  addTag(tag: string): Promise<ICampaignDocument>;
  removeTag(tag: string): Promise<ICampaignDocument>;
}

// Interface for the model
export interface ICampaignModel extends Model<ICampaignDocument> {
  findByStatus(status: CampaignStatus): Promise<ICampaignDocument[]>;
  findActive(): Promise<ICampaignDocument[]>;
  findByTag(tag: string): Promise<ICampaignDocument[]>;
  getStats(): Promise<Array<{ _id: string; count: number; totalContacts: number; totalMessages: number; totalResponses: number }>>;
  getTopPerforming(limit?: number): Promise<ICampaignDocument[]>;
}

const locationCriteriaSchema = new Schema<ILocationCriteria>({
  city: String,
  state: String,
  country: String,
  radius: Number // in miles/km
}, {
  _id: false
});

const companySizeSchema = new Schema<ICompanySize>({
  min: Number,
  max: Number
}, {
  _id: false
});

const lastContactDaysSchema = new Schema<ILastContactDays>({
  min: Number,
  max: Number
}, {
  _id: false
});

const customFilterSchema = new Schema<ICustomFilter>({
  field: String,
  operator: {
    type: String,
    enum: Object.values(FilterOperator)
  },
  value: Schema.Types.Mixed
}, {
  _id: false
});

const targetCriteriaSchema = new Schema<ITargetCriteria>({
  // Location criteria
  locations: [locationCriteriaSchema],
  // Industry criteria
  industries: [String],
  // Company criteria
  companies: [String],
  companySize: companySizeSchema,
  // Position criteria
  positions: [String],
  experienceLevel: {
    type: String,
    enum: Object.values(ExperienceLevel)
  },
  // Skills criteria
  requiredSkills: [String],
  preferredSkills: [String],
  // Contact criteria
  contactSources: [{
    type: String,
    enum: Object.values(ContactSource)
  }],
  // Response criteria
  hasResponded: Boolean,
  lastContactDays: lastContactDaysSchema,
  // Custom criteria
  customFilters: [customFilterSchema]
}, {
  _id: false
});

const statsSchema = new Schema<ICampaignStats>({
  // Contact stats
  totalContacts: {
    type: Number,
    default: 0
  },
  contactsProcessed: {
    type: Number,
    default: 0
  },
  contactsPending: {
    type: Number,
    default: 0
  },
  // Communication stats
  messagesSent: {
    type: Number,
    default: 0
  },
  emailsSent: {
    type: Number,
    default: 0
  },
  linkedinMessagesSent: {
    type: Number,
    default: 0
  },
  // Response stats
  responsesReceived: {
    type: Number,
    default: 0
  },
  positiveResponses: {
    type: Number,
    default: 0
  },
  negativeResponses: {
    type: Number,
    default: 0
  },
  // Conversion stats
  connections: {
    type: Number,
    default: 0
  },
  meetings: {
    type: Number,
    default: 0
  },
  applications: {
    type: Number,
    default: 0
  },
  // Performance metrics
  responseRate: {
    type: Number,
    default: 0
  },
  connectionRate: {
    type: Number,
    default: 0
  },
  meetingRate: {
    type: Number,
    default: 0
  },
  applicationRate: {
    type: Number,
    default: 0
  }
}, {
  _id: false
});

const campaignSettingsSchema = new Schema<ICampaignSettings>({
  // Rate limiting
  maxMessagesPerDay: {
    type: Number,
    default: 50
  },
  maxMessagesPerHour: {
    type: Number,
    default: 10
  },
  delayBetweenMessages: {
    type: Number,
    default: 300000 // 5 minutes in milliseconds
  },
  // Message settings
  personalizeMessages: {
    type: Boolean,
    default: true
  },
  followUpEnabled: {
    type: Boolean,
    default: true
  },
  followUpDelay: {
    type: Number,
    default: 7 // days
  },
  maxFollowUps: {
    type: Number,
    default: 3
  },
  // Template settings
  defaultTemplate: {
    type: String,
    ref: 'Template'
  },
  followUpTemplate: {
    type: String,
    ref: 'Template'
  }
}, {
  _id: false
});

const campaignTemplateSchema = new Schema<ICampaignTemplate>({
  template: {
    type: String,
    ref: 'Template'
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  _id: false
});

const workingHoursSchema = new Schema<IWorkingHours>({
  start: String, // HH:MM format
  end: String,   // HH:MM format
  days: [{
    type: String,
    enum: Object.values(DayOfWeek)
  }]
}, {
  _id: false
});

const campaignScheduleSchema = new Schema<ICampaignSchedule>({
  enabled: {
    type: Boolean,
    default: false
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  workingHours: workingHoursSchema,
  blackoutDates: [Date]
}, {
  _id: false
});

const campaignResultSchema = new Schema<ICampaignResult>({
  date: {
    type: Date,
    default: Date.now
  },
  action: {
    type: String,
    enum: Object.values(CampaignAction)
  },
  contactId: {
    type: String,
    ref: 'Contact'
  },
  details: String,
  metadata: Schema.Types.Mixed
}, {
  _id: false
});

const campaignSchema = new Schema<ICampaignDocument>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  targetCriteria: targetCriteriaSchema,
  status: {
    type: String,
    enum: Object.values(CampaignStatus),
    default: CampaignStatus.DRAFT
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  stats: {
    type: statsSchema,
    default: () => ({})
  },
  // Campaign settings
  settings: campaignSettingsSchema,
  // Campaign tracking
  contacts: [{
    type: String,
    ref: 'Contact'
  }],
  // Message templates used
  templates: [campaignTemplateSchema],
  // Campaign schedule
  schedule: campaignScheduleSchema,
  // Campaign results
  results: [campaignResultSchema],
  // Tags for organization
  tags: [{
    type: String,
    trim: true
  }],
  // Author information
  author: {
    type: String,
    trim: true
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
campaignSchema.index({ name: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ startDate: -1 });
campaignSchema.index({ tags: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ 'targetCriteria.industries': 1 });
campaignSchema.index({ 'targetCriteria.companies': 1 });

// Virtual for campaign duration
campaignSchema.virtual('duration').get(function(this: ICampaignDocument): number | null {
  if (!this.startDate) return null;
  const endDate = this.endDate || new Date();
  const diffTime = Math.abs(endDate.getTime() - this.startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
});

// Virtual for completion percentage
campaignSchema.virtual('completionPercentage').get(function(this: ICampaignDocument): number {
  if (this.stats.totalContacts === 0) return 0;
  return Math.round((this.stats.contactsProcessed / this.stats.totalContacts) * 100);
});

// Virtual for campaign health score
campaignSchema.virtual('healthScore').get(function(this: ICampaignDocument): number {
  let score = 0;
  
  // Response rate (40% weight)
  if (this.stats.responseRate > 0) {
    score += Math.min(this.stats.responseRate * 0.4, 40);
  }
  
  // Connection rate (30% weight)
  if (this.stats.connectionRate > 0) {
    score += Math.min(this.stats.connectionRate * 0.3, 30);
  }
  
  // Meeting rate (20% weight)
  if (this.stats.meetingRate > 0) {
    score += Math.min(this.stats.meetingRate * 0.2, 20);
  }
  
  // Application rate (10% weight)
  if (this.stats.applicationRate > 0) {
    score += Math.min(this.stats.applicationRate * 0.1, 10);
  }
  
  return Math.round(score);
});

// Pre-save middleware to update stats
campaignSchema.pre('save', function(this: ICampaignDocument, next) {
  // Calculate rates
  if (this.stats.messagesSent > 0) {
    this.stats.responseRate = (this.stats.responsesReceived / this.stats.messagesSent) * 100;
  }
  
  if (this.stats.contactsProcessed > 0) {
    this.stats.connectionRate = (this.stats.connections / this.stats.contactsProcessed) * 100;
    this.stats.meetingRate = (this.stats.meetings / this.stats.contactsProcessed) * 100;
    this.stats.applicationRate = (this.stats.applications / this.stats.contactsProcessed) * 100;
  }
  
  this.updatedAt = new Date();
  next();
});

// Instance methods
campaignSchema.methods.addContact = function(this: ICampaignDocument, contactId: string): Promise<ICampaignDocument> {
  if (!this.contacts.includes(contactId)) {
    this.contacts.push(contactId);
    this.stats.totalContacts += 1;
    this.stats.contactsPending += 1;
  }
  return this.save();
};

campaignSchema.methods.removeContact = function(this: ICampaignDocument, contactId: string): Promise<ICampaignDocument> {
  this.contacts = this.contacts.filter(id => id !== contactId);
  this.stats.totalContacts = Math.max(0, this.stats.totalContacts - 1);
  this.stats.contactsPending = Math.max(0, this.stats.contactsPending - 1);
  return this.save();
};

campaignSchema.methods.recordMessage = function(this: ICampaignDocument, type: string = 'message'): Promise<ICampaignDocument> {
  this.stats.messagesSent += 1;
  
  switch (type) {
    case 'email':
      this.stats.emailsSent += 1;
      break;
    case 'linkedin':
      this.stats.linkedinMessagesSent += 1;
      break;
  }
  
  return this.save();
};

campaignSchema.methods.recordResponse = function(this: ICampaignDocument, isPositive: boolean = true): Promise<ICampaignDocument> {
  this.stats.responsesReceived += 1;
  
  if (isPositive) {
    this.stats.positiveResponses += 1;
  } else {
    this.stats.negativeResponses += 1;
  }
  
  return this.save();
};

campaignSchema.methods.recordConnection = function(this: ICampaignDocument): Promise<ICampaignDocument> {
  this.stats.connections += 1;
  return this.save();
};

campaignSchema.methods.recordMeeting = function(this: ICampaignDocument): Promise<ICampaignDocument> {
  this.stats.meetings += 1;
  return this.save();
};

campaignSchema.methods.recordApplication = function(this: ICampaignDocument): Promise<ICampaignDocument> {
  this.stats.applications += 1;
  return this.save();
};

campaignSchema.methods.addResult = function(this: ICampaignDocument, resultData: Partial<ICampaignResult>): Promise<ICampaignDocument> {
  this.results.push(resultData as ICampaignResult);
  return this.save();
};

campaignSchema.methods.updateStatus = function(this: ICampaignDocument, newStatus: CampaignStatus): Promise<ICampaignDocument> {
  this.status = newStatus;
  if (newStatus === CampaignStatus.COMPLETED && !this.endDate) {
    this.endDate = new Date();
  }
  return this.save();
};

campaignSchema.methods.addTag = function(this: ICampaignDocument, tag: string): Promise<ICampaignDocument> {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

campaignSchema.methods.removeTag = function(this: ICampaignDocument, tag: string): Promise<ICampaignDocument> {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Static methods
campaignSchema.statics.findByStatus = function(this: ICampaignModel, status: CampaignStatus): Promise<ICampaignDocument[]> {
  return this.find({ status });
};

campaignSchema.statics.findActive = function(this: ICampaignModel): Promise<ICampaignDocument[]> {
  return this.find({ status: CampaignStatus.ACTIVE });
};

campaignSchema.statics.findByTag = function(this: ICampaignModel, tag: string): Promise<ICampaignDocument[]> {
  return this.find({ tags: tag });
};

campaignSchema.statics.getStats = function(this: ICampaignModel): Promise<Array<{ _id: string; count: number; totalContacts: number; totalMessages: number; totalResponses: number }>> {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalContacts: { $sum: '$stats.totalContacts' },
        totalMessages: { $sum: '$stats.messagesSent' },
        totalResponses: { $sum: '$stats.responsesReceived' }
      }
    }
  ]);
};

campaignSchema.statics.getTopPerforming = function(this: ICampaignModel, limit: number = 10): Promise<ICampaignDocument[]> {
  return this.find({ status: { $in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] } })
    .sort({ 'stats.responseRate': -1 })
    .limit(limit);
};

// Transform JSON output
campaignSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc: ICampaignDocument, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Campaign = mongoose.model<ICampaignDocument, ICampaignModel>('Campaign', campaignSchema);

export default Campaign;
