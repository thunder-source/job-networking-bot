import mongoose, { Document, Schema, Model } from 'mongoose';
import type {
    IContact,
    IConversationHistory,
    ILocation
} from '../types/index.js';
import {
    ContactStatus,
    ContactSource,
    ConversationType,
    ConversationDirection,
    ExperienceLevel,
    Priority
} from '../types/index.js';

// Interface for the document
export interface IContactDocument extends Omit<IContact, '_id'>, Document {
    displayName: string;
    daysSinceLastContact: number | null;
    addConversation(conversationData: Partial<IConversationHistory>): Promise<IContactDocument>;
    updateStatus(newStatus: ContactStatus): Promise<IContactDocument>;
    addTag(tag: string): Promise<IContactDocument>;
    removeTag(tag: string): Promise<IContactDocument>;
}

// Interface for the model
export interface IContactModel extends Model<IContactDocument> {
    findByStatus(status: ContactStatus): Promise<IContactDocument[]>;
    findBySource(source: ContactSource): Promise<IContactDocument[]>;
    findByCompany(company: string): Promise<IContactDocument[]>;
    findByTag(tag: string): Promise<IContactDocument[]>;
    getStats(): Promise<Array<{ _id: string; count: number }>>;
}

const conversationHistorySchema = new Schema<IConversationHistory>({
    date: {
        type: Date,
        default: Date.now
    },
    type: {
        type: String,
        enum: Object.values(ConversationType),
        required: true
    },
    content: {
        type: String,
        required: true
    },
    direction: {
        type: String,
        enum: Object.values(ConversationDirection),
        required: true
    },
    subject: String,
    attachments: [String] // Array of file paths or URLs
}, {
    _id: true
});

const locationSchema = new Schema<ILocation>({
    city: String,
    state: String,
    country: String
}, {
    _id: false
});

const contactSchema = new Schema<IContactDocument>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    linkedinUrl: {
        type: String,
        trim: true,
        match: [/^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/, 'Please enter a valid LinkedIn URL']
    },
    company: {
        type: String,
        trim: true
    },
    position: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: Object.values(ContactStatus),
        default: ContactStatus.PENDING
    },
    lastContactDate: {
        type: Date,
        default: Date.now
    },
    conversationHistory: [conversationHistorySchema],
    notes: {
        type: String,
        trim: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    source: {
        type: String,
        enum: Object.values(ContactSource),
        required: true
    },
    // Additional fields for better contact management
    phone: {
        type: String,
        trim: true
    },
    location: locationSchema,
    industry: {
        type: String,
        trim: true
    },
    experience: {
        type: String,
        enum: Object.values(ExperienceLevel)
    },
    priority: {
        type: String,
        enum: Object.values(Priority),
        default: Priority.MEDIUM
    },
    // Campaign tracking
    campaigns: [{
        type: Schema.Types.ObjectId,
        ref: 'Campaign'
    }],
    // Response tracking
    responseRate: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    lastResponseDate: Date,
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
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ source: 1 });
contactSchema.index({ company: 1 });
contactSchema.index({ tags: 1 });
contactSchema.index({ lastContactDate: -1 });
contactSchema.index({ createdAt: -1 });

// Virtual for full name with company
contactSchema.virtual('displayName').get(function (this: IContactDocument): string {
    if (this.company) {
        return `${this.name} at ${this.company}`;
    }
    return this.name;
});

// Virtual for days since last contact
contactSchema.virtual('daysSinceLastContact').get(function (this: IContactDocument): number | null {
    if (!this.lastContactDate) return null;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.lastContactDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update lastContactDate when conversationHistory changes
contactSchema.pre('save', function (this: IContactDocument, next) {
    if (this.isModified('conversationHistory') && this.conversationHistory.length > 0) {
        const lastConversation = this.conversationHistory[this.conversationHistory.length - 1];
        if (lastConversation) {
            this.lastContactDate = lastConversation.date;
        }
    }
    this.updatedAt = new Date();
    next();
});

// Instance methods
contactSchema.methods.addConversation = function (this: IContactDocument, conversationData: Partial<IConversationHistory>): Promise<IContactDocument> {
    this.conversationHistory.push(conversationData as IConversationHistory);
    this.lastContactDate = conversationData.date || new Date();
    return this.save();
};

contactSchema.methods.updateStatus = function (this: IContactDocument, newStatus: ContactStatus): Promise<IContactDocument> {
    this.status = newStatus;
    this.updatedAt = new Date();
    return this.save();
};

contactSchema.methods.addTag = function (this: IContactDocument, tag: string): Promise<IContactDocument> {
    if (!this.tags.includes(tag)) {
        this.tags.push(tag);
    }
    return this.save();
};

contactSchema.methods.removeTag = function (this: IContactDocument, tag: string): Promise<IContactDocument> {
    this.tags = this.tags.filter(t => t !== tag);
    return this.save();
};

// Static methods
contactSchema.statics.findByStatus = function (this: IContactModel, status: ContactStatus): Promise<IContactDocument[]> {
    return this.find({ status });
};

contactSchema.statics.findBySource = function (this: IContactModel, source: ContactSource): Promise<IContactDocument[]> {
    return this.find({ source });
};

contactSchema.statics.findByCompany = function (this: IContactModel, company: string): Promise<IContactDocument[]> {
    return this.find({ company: new RegExp(company, 'i') });
};

contactSchema.statics.findByTag = function (this: IContactModel, tag: string): Promise<IContactDocument[]> {
    return this.find({ tags: tag });
};

contactSchema.statics.getStats = function (this: IContactModel): Promise<Array<{ _id: string; count: number }>> {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
};

// Transform JSON output
contactSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc: IContactDocument, ret: any) {
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

const Contact = mongoose.model<IContactDocument, IContactModel>('Contact', contactSchema);

export default Contact;
