import mongoose, { Document, Schema, Model } from 'mongoose';
import type {
    ITemplate,
    ITemplateVariable,
    ITemplateVersion,
    ITemplateSettings,
    IVariableValidation
} from '../types/index.js';
import {
    TemplateType,
    TemplateCategory,
    VariableType
} from '../types/index.js';

// Interface for the document
export interface ITemplateDocument extends Omit<ITemplate, '_id'>, Document {
    preview: string;
    requiredVariables: ITemplateVariable[];
    incrementUsage(): Promise<ITemplateDocument>;
    render(variables?: Record<string, any>): string;
    validateVariables(variables?: Record<string, any>): string[];
    addTag(tag: string): Promise<ITemplateDocument>;
    removeTag(tag: string): Promise<ITemplateDocument>;
}

// Interface for the model
export interface ITemplateModel extends Model<ITemplateDocument> {
    findByType(type: TemplateType): Promise<ITemplateDocument[]>;
    findByCategory(category: TemplateCategory): Promise<ITemplateDocument[]>;
    findByTag(tag: string): Promise<ITemplateDocument[]>;
    getMostUsed(limit?: number): Promise<ITemplateDocument[]>;
    search(query: string): Promise<ITemplateDocument[]>;
}

const variableValidationSchema = new Schema<IVariableValidation>({
    minLength: Number,
    maxLength: Number,
    pattern: String, // Regex pattern
    min: Number,
    max: Number
}, {
    _id: false
});

const variableSchema = new Schema<ITemplateVariable>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: Object.values(VariableType),
        default: VariableType.STRING
    },
    required: {
        type: Boolean,
        default: false
    },
    defaultValue: Schema.Types.Mixed,
    validation: variableValidationSchema
}, {
    _id: true
});

const templateVersionSchema = new Schema<ITemplateVersion>({
    content: String,
    variables: [variableSchema],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    _id: false
});

const templateSettingsSchema = new Schema<ITemplateSettings>({
    maxLength: Number,
    minLength: Number,
    allowHtml: {
        type: Boolean,
        default: false
    },
    allowMarkdown: {
        type: Boolean,
        default: true
    }
}, {
    _id: false
});

const templateSchema = new Schema<ITemplateDocument>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: Object.values(TemplateType),
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    variables: [variableSchema],
    // Additional template metadata
    subject: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        enum: Object.values(TemplateCategory),
        default: TemplateCategory.NETWORKING
    },
    // Template settings
    isActive: {
        type: Boolean,
        default: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    // Usage tracking
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: Date,
    // Template versioning
    version: {
        type: Number,
        default: 1
    },
    previousVersions: [templateVersionSchema],
    // Template settings
    settings: templateSettingsSchema,
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
templateSchema.index({ name: 1 }, { unique: true });
templateSchema.index({ type: 1 });
templateSchema.index({ category: 1 });
templateSchema.index({ isActive: 1 });
templateSchema.index({ tags: 1 });
templateSchema.index({ createdAt: -1 });

// Virtual for template preview (first 100 characters)
templateSchema.virtual('preview').get(function (this: ITemplateDocument): string {
    return this.content.length > 100 ? this.content.substring(0, 100) + '...' : this.content;
});

// Virtual for required variables
templateSchema.virtual('requiredVariables').get(function (this: ITemplateDocument): ITemplateVariable[] {
    return this.variables.filter(variable => variable.required);
});

// Pre-save middleware to update version and track changes
templateSchema.pre('save', function (this: ITemplateDocument, next) {
    if (this.isModified('content') || this.isModified('variables')) {
        // Save previous version
        if (this.content && this.variables) {
            this.previousVersions.push({
                content: this.content,
                variables: this.variables,
                createdAt: new Date()
            });
        }

        // Increment version
        this.version += 1;
    }

    this.updatedAt = new Date();
    next();
});

// Instance methods
templateSchema.methods.incrementUsage = function (this: ITemplateDocument): Promise<ITemplateDocument> {
    this.usageCount += 1;
    this.lastUsed = new Date();
    return this.save();
};

templateSchema.methods.render = function (this: ITemplateDocument, variables: Record<string, any> = {}): string {
    let renderedContent = this.content;

    // Replace variables in content
    this.variables.forEach(variable => {
        const placeholder = `{{${variable.name}}}`;
        const value = variables[variable.name] || variable.defaultValue || '';

        if (variable.required && !variables[variable.name]) {
            throw new Error(`Required variable '${variable.name}' is missing`);
        }

        renderedContent = renderedContent.replace(new RegExp(placeholder, 'g'), value);
    });

    return renderedContent;
};

templateSchema.methods.validateVariables = function (this: ITemplateDocument, variables: Record<string, any> = {}): string[] {
    const errors: string[] = [];

    this.variables.forEach(variable => {
        const value = variables[variable.name];

        // Check required variables
        if (variable.required && (!value || value === '')) {
            errors.push(`Required variable '${variable.name}' is missing`);
            return;
        }

        if (value !== undefined && value !== null && value !== '') {
            // Type validation
            switch (variable.type) {
                case VariableType.STRING:
                    if (typeof value !== 'string') {
                        errors.push(`Variable '${variable.name}' must be a string`);
                    } else {
                        // Length validation
                        if (variable.validation?.minLength && value.length < variable.validation.minLength) {
                            errors.push(`Variable '${variable.name}' must be at least ${variable.validation.minLength} characters`);
                        }
                        if (variable.validation?.maxLength && value.length > variable.validation.maxLength) {
                            errors.push(`Variable '${variable.name}' must be no more than ${variable.validation.maxLength} characters`);
                        }
                        // Pattern validation
                        if (variable.validation?.pattern) {
                            const regex = new RegExp(variable.validation.pattern);
                            if (!regex.test(value)) {
                                errors.push(`Variable '${variable.name}' does not match required pattern`);
                            }
                        }
                    }
                    break;
                case VariableType.NUMBER:
                    if (typeof value !== 'number' || isNaN(value)) {
                        errors.push(`Variable '${variable.name}' must be a number`);
                    } else {
                        if (variable.validation?.min !== undefined && value < variable.validation.min) {
                            errors.push(`Variable '${variable.name}' must be at least ${variable.validation.min}`);
                        }
                        if (variable.validation?.max !== undefined && value > variable.validation.max) {
                            errors.push(`Variable '${variable.name}' must be no more than ${variable.validation.max}`);
                        }
                    }
                    break;
                case VariableType.DATE:
                    if (!(value instanceof Date) && isNaN(Date.parse(value))) {
                        errors.push(`Variable '${variable.name}' must be a valid date`);
                    }
                    break;
                case VariableType.BOOLEAN:
                    if (typeof value !== 'boolean') {
                        errors.push(`Variable '${variable.name}' must be a boolean`);
                    }
                    break;
                case VariableType.ARRAY:
                    if (!Array.isArray(value)) {
                        errors.push(`Variable '${variable.name}' must be an array`);
                    }
                    break;
            }
        }
    });

    return errors;
};

templateSchema.methods.addTag = function (this: ITemplateDocument, tag: string): Promise<ITemplateDocument> {
    if (!this.tags.includes(tag)) {
        this.tags.push(tag);
    }
    return this.save();
};

templateSchema.methods.removeTag = function (this: ITemplateDocument, tag: string): Promise<ITemplateDocument> {
    this.tags = this.tags.filter(t => t !== tag);
    return this.save();
};

// Static methods
templateSchema.statics.findByType = function (this: ITemplateModel, type: TemplateType): Promise<ITemplateDocument[]> {
    return this.find({ type, isActive: true });
};

templateSchema.statics.findByCategory = function (this: ITemplateModel, category: TemplateCategory): Promise<ITemplateDocument[]> {
    return this.find({ category, isActive: true });
};

templateSchema.statics.findByTag = function (this: ITemplateModel, tag: string): Promise<ITemplateDocument[]> {
    return this.find({ tags: tag, isActive: true });
};

templateSchema.statics.getMostUsed = function (this: ITemplateModel, limit: number = 10): Promise<ITemplateDocument[]> {
    return this.find({ isActive: true })
        .sort({ usageCount: -1 })
        .limit(limit);
};

templateSchema.statics.search = function (this: ITemplateModel, query: string): Promise<ITemplateDocument[]> {
    return this.find({
        $and: [
            { isActive: true },
            {
                $or: [
                    { name: new RegExp(query, 'i') },
                    { content: new RegExp(query, 'i') },
                    { description: new RegExp(query, 'i') },
                    { tags: new RegExp(query, 'i') }
                ]
            }
        ]
    });
};

// Transform JSON output
templateSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc: ITemplateDocument, ret: any) {
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

const Template = mongoose.model<ITemplateDocument, ITemplateModel>('Template', templateSchema);

export default Template;
